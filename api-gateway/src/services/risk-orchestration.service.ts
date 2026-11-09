import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RiskResultEntity } from '../entities/risk-result.entity';
import { BackgroundJobService } from './background-job.service';
import { LoggingService } from './logging.service';
import { MarketDataService } from './market-data.service';
import { MlClientService } from './ml-client.service';
import { PortfolioService } from './portfolio.service';
import { RedisCacheService } from './redis-cache.service';
import { decimal, toNumericString } from '../utils/round.util';

type LexiconScreenLabel = 'positive' | 'neutral' | 'negative';

interface ComputedRiskResult {
  portfolioId: string;
  portfolioName: string;
  portfolioValue: number;
  var95: number;
  volatility: number;
  expectedShortfall: number;
  anomaly: {
    score: number;
    zScore: number;
    detected: boolean;
  };
  sentiment: Array<{ symbol: string; score: number; label: LexiconScreenLabel }>;
  composition: Array<{ symbol: string; weight: number; quantity: number; price: number }>;
  timeseries: Array<{ day: number; value: number }>;
  premiumAnalytics: {
    tailRisk: unknown;
    regime: unknown;
    optimization: unknown;
    financialSentiment: unknown;
    factorExposures?: unknown;
    varBacktest?: unknown;
  };
  varMethod: string;
  modelVersion: string;
  modelConfig: Record<string, unknown>;
}

const RISK_MODEL_CONFIG = {
  modelVersion: 'risk-var-suite-v2.0.0',
  premiumModelVersion: 'premium-risk-analytics-v2.0.0',
  confidence: 0.95,
  selectedVarMethod: 'historical' as const,
  deterministicSeed: 1729,
  monteCarloSimulations: 20000,
  varBacktestWindow: 60,
};

@Injectable()
export class RiskOrchestrationService {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly mlClientService: MlClientService,
    private readonly marketDataService: MarketDataService,
    private readonly loggingService: LoggingService,
    private readonly backgroundJobService: BackgroundJobService,
    private readonly cacheService: RedisCacheService,
    @InjectRepository(RiskResultEntity)
    private readonly riskResultRepository: Repository<RiskResultEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async calculateRisk(portfolioId: string, userId: string, tenantId: string) {
    const portfolio = await this.portfolioService.getPortfolioById(portfolioId, userId, tenantId);
    const computed = await this.computeRisk(portfolio, { includePremiumAnalytics: false });
    const savedResult = await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).save(
      manager.getRepository(RiskResultEntity).create({
        portfolio,
        tenant: portfolio.tenant,
        status: 'completed',
        jobId: null,
        var95: toNumericString(computed.var95),
        volatility: toNumericString(computed.volatility),
        expectedShortfall: toNumericString(computed.expectedShortfall),
        portfolioValue: toNumericString(computed.portfolioValue),
        anomalyScore: toNumericString(computed.anomaly.score),
        anomalyZScore: toNumericString(computed.anomaly.zScore),
        anomalyDetected: computed.anomaly.detected,
        sentimentJson: computed.sentiment,
        compositionJson: computed.composition,
        timeseriesJson: computed.timeseries,
        premiumAnalyticsJson: computed.premiumAnalytics,
        varMethod: computed.varMethod,
        modelVersion: computed.modelVersion,
        modelConfigJson: computed.modelConfig,
        inputHash: this.buildInputHash(portfolio),
        completedAt: new Date(),
      }),
    ));

    await this.loggingService.info('Risk calculation completed synchronously', portfolio.id);
    return this.toRiskResponse(savedResult);
  }

  async createAnalysis(portfolioId: string, userId: string, tenantId: string) {
    const portfolio = await this.portfolioService.getPortfolioById(portfolioId, userId, tenantId);
    const inputHash = this.buildInputHash(portfolio);
    const cached = await this.cacheService.getJson<ComputedRiskResult>(`risk:${inputHash}`);

    const analysis = await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).save(
      manager.getRepository(RiskResultEntity).create({
        portfolio,
        tenant: portfolio.tenant,
        status: cached ? 'completed' : 'pending',
        jobId: null,
        inputHash,
      }),
    ));

    analysis.jobId = `risk-analysis-${analysis.id}`;

    if (cached) {
      await this.completeAnalysisFromComputedResult(analysis, cached, tenantId);
      return this.getAnalysis(analysis.id, userId, tenantId);
    }

    await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).save(analysis));
    this.backgroundJobService.enqueue(analysis.jobId, async () => this.processAnalysis(analysis.id, tenantId));

    return this.toAnalysisStatus(analysis);
  }

  async getAnalysis(analysisId: string, userId: string, tenantId: string) {
    const analysis = await this.findAnalysisForUser(analysisId, userId, tenantId);
    return this.toAnalysisStatus(analysis);
  }

  async listAnalyses(portfolioId: string, userId: string, tenantId: string) {
    await this.portfolioService.getPortfolioById(portfolioId, userId, tenantId);
    const analyses = await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).find({
      where: { tenant: { id: tenantId }, portfolio: { id: portfolioId, user: { id: userId } } },
      relations: { portfolio: { user: true } },
      order: { createdAt: 'DESC' },
      take: 25,
    }));

    return analyses.map((analysis) => this.toAnalysisStatus(analysis));
  }

  async compareAnalyses(portfolioId: string, userId: string, tenantId: string, fromId: string, toId: string) {
    await this.portfolioService.getPortfolioById(portfolioId, userId, tenantId);
    const [from, to] = await Promise.all([
      this.findAnalysisForUser(fromId, userId, tenantId),
      this.findAnalysisForUser(toId, userId, tenantId),
    ]);

    if (from.portfolio.id !== portfolioId || to.portfolio.id !== portfolioId) {
      throw new NotFoundException('Analysis comparison not found');
    }

    const fromRisk = this.toRiskResponse(from);
    const toRisk = this.toRiskResponse(to);

    return {
      portfolioId,
      from: fromRisk,
      to: toRisk,
      delta: {
        portfolioValue: toRisk.portfolioValue - fromRisk.portfolioValue,
        var95: toRisk.var95 - fromRisk.var95,
        volatility: toRisk.volatility - fromRisk.volatility,
        expectedShortfall: toRisk.expectedShortfall - fromRisk.expectedShortfall,
        anomalyScore: toRisk.anomaly.score - fromRisk.anomaly.score,
      },
    };
  }

  async backtestPortfolio(portfolioId: string, userId: string, tenantId: string, periods = 180) {
    const portfolio = await this.portfolioService.getPortfolioById(portfolioId, userId, tenantId);
    const boundedPeriods = Math.max(30, Math.min(periods, 730));
    const assets = portfolio.assets.map((asset) => ({
      symbol: asset.symbol,
      weight: Number(asset.weight),
      quantity: Number(asset.quantity),
    }));

    const weights = assets.map((asset) => asset.weight);
    const returnsByAsset = await Promise.all(
      assets.map((asset) => this.marketDataService.getAssetReturns(asset.symbol, boundedPeriods)),
    );
    const initialValue = await this.marketDataService.calculatePortfolioValue(assets);
    const series = this.marketDataService.buildPortfolioSeries(returnsByAsset, weights, initialValue);
    const peakDrawdown = this.calculateMaxDrawdown(series);
    const endingValue = series[series.length - 1] ?? initialValue;

    return {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      periods: boundedPeriods,
      initialValue,
      endingValue,
      cumulativeReturn: decimal(endingValue).minus(initialValue).div(initialValue).toDecimalPlaces(10).toNumber(),
      maxDrawdown: peakDrawdown,
      series: series.map((value, idx) => ({
        day: idx + 1,
        value,
      })),
    };
  }

  private async processAnalysis(analysisId: string, tenantId: string) {
    const analysis = await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).findOne({
      where: { id: analysisId },
      relations: { portfolio: { assets: true, user: true } },
    }));

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).update(analysis.id, {
      status: 'processing',
      errorCode: null,
      errorMessage: null,
    }));

    try {
      const computed = await this.computeRisk(analysis.portfolio);
      await this.completeAnalysisFromComputedResult(analysis, computed, tenantId);
      await this.cacheService.setJson(`risk:${analysis.inputHash}`, computed, 60 * 15);
      await this.loggingService.info('Async risk analysis completed', analysis.portfolio.id);
    } catch (error) {
      await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).update(analysis.id, {
        status: 'failed',
        errorCode: 'ML_ANALYSIS_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Risk analysis failed',
        failedAt: new Date(),
      }));
      throw error;
    }
  }

  private async completeAnalysisFromComputedResult(
    analysis: RiskResultEntity,
    computed: ComputedRiskResult,
    tenantId: string,
  ) {
    await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).update(analysis.id, {
      status: 'completed',
      var95: toNumericString(computed.var95),
      volatility: toNumericString(computed.volatility),
      expectedShortfall: toNumericString(computed.expectedShortfall),
      portfolioValue: toNumericString(computed.portfolioValue),
      anomalyScore: toNumericString(computed.anomaly.score),
      anomalyZScore: toNumericString(computed.anomaly.zScore),
      anomalyDetected: computed.anomaly.detected,
      sentimentJson: computed.sentiment,
      compositionJson: computed.composition,
      timeseriesJson: computed.timeseries,
      premiumAnalyticsJson: computed.premiumAnalytics,
      varMethod: computed.varMethod,
      modelVersion: computed.modelVersion,
      modelConfigJson: computed.modelConfig,
      completedAt: new Date(),
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    }));
  }

  private async computeRisk(
    portfolio: Awaited<ReturnType<PortfolioService['getPortfolioById']>>,
    options: { includePremiumAnalytics: boolean } = { includePremiumAnalytics: true },
  ) {
    const assets = portfolio.assets.map((asset) => ({
      symbol: asset.symbol,
      weight: Number(asset.weight),
      quantity: Number(asset.quantity),
    }));

    const weights = assets.map((asset) => asset.weight);
    const symbols = assets.map((asset) => asset.symbol);
    const returnsByAsset = await Promise.all(
      assets.map((asset) => this.marketDataService.getAssetReturns(asset.symbol)),
    );
    const portfolioValue = await this.marketDataService.calculatePortfolioValue(assets);

    const riskMetrics = await this.mlClientService.calculateRisk({
      confidence: RISK_MODEL_CONFIG.confidence,
      method: RISK_MODEL_CONFIG.selectedVarMethod,
      seed: RISK_MODEL_CONFIG.deterministicSeed,
      simulations: RISK_MODEL_CONFIG.monteCarloSimulations,
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

    const lexiconScreenInput = await this.marketDataService.getNews(assets.map((asset) => asset.symbol));
    const lexiconScreenMetrics = await this.mlClientService.screenFinancialNewsLexicon({
      items: lexiconScreenInput,
    });

    const advancedPayload = {
      symbols,
      weights,
      asset_returns: returnsByAsset,
    };

    const compositionPrices = await Promise.all(assets.map((asset) => this.marketDataService.getPrice(asset.symbol)));

    let premiumAnalytics: ComputedRiskResult['premiumAnalytics'] = {
      tailRisk: null,
      regime: null,
      optimization: null,
      financialSentiment: lexiconScreenMetrics.results,
    };

    if (options.includePremiumAnalytics) {
      const [historicalScenarios, factorReturns] = await Promise.all([
        this.marketDataService.getHistoricalScenarioReturns(symbols),
        this.marketDataService.getFactorReturns(Math.min(...returnsByAsset.map((returns) => returns.length))),
      ]);

      const premiumPayload = {
        ...advancedPayload,
        historical_scenarios: historicalScenarios,
      };

      const [tailRisk, regime, optimization, factorExposures, varBacktest] = await Promise.all([
        this.mlClientService.calculateTailRisk(premiumPayload),
        this.mlClientService.detectMarketRegime(advancedPayload),
        this.mlClientService.optimizePortfolio(advancedPayload),
        this.mlClientService.calculateFactorExposures({
          ...advancedPayload,
          factor_returns: factorReturns,
        }),
        this.mlClientService.backtestVar({
          weights,
          asset_returns: returnsByAsset,
          confidence: RISK_MODEL_CONFIG.confidence,
          window: RISK_MODEL_CONFIG.varBacktestWindow,
        }),
      ]);

      premiumAnalytics = {
        tailRisk,
        regime,
        optimization,
        financialSentiment: lexiconScreenMetrics.results,
        factorExposures,
        varBacktest,
      };
    }

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
      sentiment: this.aggregateLexiconScreenBySymbol(lexiconScreenMetrics.results),
      composition: assets.map((asset, idx) => ({
        symbol: asset.symbol,
        weight: asset.weight,
        quantity: asset.quantity,
        price: compositionPrices[idx],
      })),
      timeseries: portfolioSeries.map((value, idx) => ({
        day: idx + 1,
        value,
      })),
      premiumAnalytics,
      varMethod: riskMetrics.selected_method,
      modelVersion: riskMetrics.model_version,
      modelConfig: {
        ...RISK_MODEL_CONFIG,
        varMethods: riskMetrics.methods,
        deterministicSeed: riskMetrics.deterministic_seed,
      },
    };
  }

  private async findAnalysisForUser(analysisId: string, userId: string, tenantId: string) {
    const analysis = await this.withTenant(tenantId, async (manager) => manager.getRepository(RiskResultEntity).findOne({
      where: { id: analysisId, tenant: { id: tenantId }, portfolio: { user: { id: userId } } },
      relations: { portfolio: { user: true } },
    }));

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    return analysis;
  }

  private async withTenant<T>(tenantId: string, work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      return work(manager);
    });
  }

  private toAnalysisStatus(analysis: RiskResultEntity) {
    return {
      id: analysis.id,
      portfolioId: analysis.portfolio.id,
      status: analysis.status,
      jobId: analysis.jobId,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt,
      completedAt: analysis.completedAt,
      failedAt: analysis.failedAt,
      errorCode: analysis.errorCode,
      errorMessage: analysis.errorMessage,
      result: analysis.status === 'completed' ? this.toRiskResponse(analysis) : null,
    };
  }

  private toRiskResponse(analysis: RiskResultEntity) {
    if (analysis.status !== 'completed') {
      throw new NotFoundException(`Analysis ${analysis.id} has not completed`);
    }

    return {
      analysisId: analysis.id,
      portfolioId: analysis.portfolio.id,
      portfolioName: analysis.portfolio.name,
      portfolioValue: Number(analysis.portfolioValue),
      var95: Number(analysis.var95),
      volatility: Number(analysis.volatility),
      expectedShortfall: Number(analysis.expectedShortfall),
      anomaly: {
        score: Number(analysis.anomalyScore),
        zScore: Number(analysis.anomalyZScore),
        detected: Boolean(analysis.anomalyDetected),
      },
      sentiment: analysis.sentimentJson,
      composition: analysis.compositionJson,
      timeseries: analysis.timeseriesJson,
      premiumAnalytics: analysis.premiumAnalyticsJson,
      varMethod: analysis.varMethod,
      modelVersion: analysis.modelVersion,
      modelConfig: analysis.modelConfigJson,
      generatedAt: analysis.completedAt ?? analysis.generatedAt,
    };
  }

  private buildInputHash(portfolio: Awaited<ReturnType<PortfolioService['getPortfolioById']>>) {
    const payload = {
      portfolioId: portfolio.id,
      assets: portfolio.assets
        .map((asset) => ({
          symbol: asset.symbol,
          weight: Number(asset.weight),
          quantity: Number(asset.quantity),
        }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
      modelConfig: RISK_MODEL_CONFIG,
    };

    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private calculateMaxDrawdown(series: number[]) {
    let peak = series[0] ?? 0;
    let maxDrawdown = 0;

    series.forEach((value) => {
      peak = Math.max(peak, value);
      if (peak > 0) {
        maxDrawdown = Math.min(maxDrawdown, (value - peak) / peak);
      }
    });

    return Number(maxDrawdown.toFixed(6));
  }

  private aggregateLexiconScreenBySymbol(
    screens: Array<{ symbol: string; score: number; label: LexiconScreenLabel }>,
  ) {
    const grouped = new Map<string, { total: number; count: number }>();

    screens.forEach((entry) => {
      const current = grouped.get(entry.symbol) ?? { total: 0, count: 0 };
      grouped.set(entry.symbol, {
        total: current.total + entry.score,
        count: current.count + 1,
      });
    });

    return Array.from(grouped.entries()).map(([symbol, value]) => {
      const score = Number((value.total / value.count).toFixed(4));
      let label: LexiconScreenLabel = 'neutral';
      if (score > 0.2) {
        label = 'positive';
      } else if (score < -0.2) {
        label = 'negative';
      }

      return { symbol, score, label };
    });
  }
}
