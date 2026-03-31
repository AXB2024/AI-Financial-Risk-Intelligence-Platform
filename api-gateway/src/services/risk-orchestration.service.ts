import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskResultEntity } from '../entities/risk-result.entity';
import { LoggingService } from './logging.service';
import { MarketDataService } from './market-data.service';
import { MlClientService } from './ml-client.service';
import { PortfolioService } from './portfolio.service';

@Injectable()
export class RiskOrchestrationService {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly mlClientService: MlClientService,
    private readonly marketDataService: MarketDataService,
    private readonly loggingService: LoggingService,
    @InjectRepository(RiskResultEntity)
    private readonly riskResultRepository: Repository<RiskResultEntity>,
  ) {}

  async calculateRisk(portfolioId: string) {
    const portfolio = await this.portfolioService.getPortfolioById(portfolioId);

    const assets = portfolio.assets.map((asset) => ({
      symbol: asset.symbol,
      weight: Number(asset.weight),
      quantity: Number(asset.quantity),
    }));

    const weights = assets.map((asset) => asset.weight);
    const returnsByAsset = assets.map((asset) =>
      this.marketDataService.generateAssetReturns(asset.symbol),
    );

    const portfolioValue = this.marketDataService.calculatePortfolioValue(assets);

    const riskMetrics = await this.mlClientService.calculateRisk({
      confidence: 0.95,
      weights,
      asset_returns: returnsByAsset,
    });

    const portfolioSeries = this.marketDataService.buildPortfolioSeries(
      returnsByAsset,
      weights,
      portfolioValue,
    );

    const anomalyMetrics = await this.mlClientService.detectAnomaly({
      series: portfolioSeries,
    });

    const sentimentInput = this.marketDataService.getMockNews(assets.map((asset) => asset.symbol));
    const sentimentMetrics = await this.mlClientService.analyzeSentiment({
      items: sentimentInput,
    });

    const mergedSentiment = this.aggregateSentimentBySymbol(sentimentMetrics.results);

    const storedResult = this.riskResultRepository.create({
      portfolio,
      var95: riskMetrics.var_95.toFixed(6),
      volatility: riskMetrics.volatility.toFixed(6),
      anomalyScore: anomalyMetrics.anomaly_score.toFixed(6),
      anomalyDetected: anomalyMetrics.is_anomaly,
      sentimentJson: mergedSentiment,
    });
    const savedResult = await this.riskResultRepository.save(storedResult);

    await this.loggingService.info('Risk calculation completed', portfolio.id);

    return {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      portfolioValue,
      var95: riskMetrics.var_95,
      volatility: riskMetrics.volatility,
      expectedShortfall: riskMetrics.expected_shortfall,
      anomaly: {
        score: anomalyMetrics.anomaly_score,
        zScore: anomalyMetrics.z_score,
        detected: anomalyMetrics.is_anomaly,
      },
      sentiment: mergedSentiment,
      composition: assets.map((asset) => ({
        symbol: asset.symbol,
        weight: asset.weight,
        quantity: asset.quantity,
        price: this.marketDataService.getPrice(asset.symbol),
      })),
      timeseries: portfolioSeries.map((value, idx) => ({
        day: idx + 1,
        value,
      })),
      generatedAt: savedResult.generatedAt,
    };
  }

  private aggregateSentimentBySymbol(
    sentiments: Array<{ symbol: string; score: number; label: 'positive' | 'neutral' | 'negative' }>,
  ) {
    const grouped = new Map<string, { total: number; count: number }>();

    sentiments.forEach((entry) => {
      const current = grouped.get(entry.symbol) ?? { total: 0, count: 0 };
      grouped.set(entry.symbol, {
        total: current.total + entry.score,
        count: current.count + 1,
      });
    });

    return Array.from(grouped.entries()).map(([symbol, value]) => {
      const score = Number((value.total / value.count).toFixed(4));
      let label: 'positive' | 'neutral' | 'negative' = 'neutral';
      if (score > 0.2) {
        label = 'positive';
      } else if (score < -0.2) {
        label = 'negative';
      }

      return { symbol, score, label };
    });
  }
}
