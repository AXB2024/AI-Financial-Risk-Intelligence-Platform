import { Injectable } from '@nestjs/common';
import { FinnhubService } from './finnhub.service';

interface AssetForPricing {
  symbol: string;
  quantity: number;
  weight: number;
}

const MIN_LIVE_RETURNS_RATIO = 0.5;

@Injectable()
export class MarketDataService {
  private readonly mockPrices: Record<string, number> = {
    AAPL: 191.22,
    MSFT: 428.73,
    AMZN: 178.11,
    GOOGL: 151.63,
    NVDA: 1108.44,
    TSLA: 233.07,
    META: 501.29,
    JPM: 195.34,
  };

  private readonly mockNewsBySymbol: Record<string, string[]> = {
    AAPL: [
      'Apple expands buyback program after strong cash flow quarter.',
      'New product cycle drives optimism in consumer demand forecasts.',
    ],
    MSFT: [
      'Cloud segment growth beats analyst expectations for enterprise demand.',
      'Regulators review software licensing practices in major procurement channels.',
    ],
    AMZN: [
      'Logistics efficiency improvements reduce delivery costs across regions.',
      'Retail margins pressured by aggressive promotional pricing strategy.',
    ],
    GOOGL: [
      'Advertising recovery supports improved revenue guidance.',
      'AI infrastructure spending rises ahead of monetization timeline.',
    ],
    NVDA: [
      'Data center demand remains elevated amid AI expansion.',
      'Supply bottlenecks may limit near-term shipment volume.',
    ],
    TSLA: [
      'EV sales soften in select regions due to pricing competition.',
      'Energy storage unit reports record project pipeline expansion.',
    ],
  };

  constructor(private readonly finnhubService: FinnhubService) {}

  async getAssetReturns(symbol: string, periods = 180): Promise<number[]> {
    const live = await this.finnhubService.getDailyReturns(symbol.toUpperCase(), periods);
    if (live && live.length >= Math.min(30, periods * MIN_LIVE_RETURNS_RATIO)) {
      return live;
    }

    return this.generateSyntheticReturns(symbol, periods);
  }

  async calculatePortfolioValue(assets: AssetForPricing[]): Promise<number> {
    const hasExplicitQuantities = assets.some((asset) => asset.quantity > 0);
    if (!hasExplicitQuantities) {
      return 100000;
    }

    const prices = await Promise.all(assets.map((asset) => this.getPrice(asset.symbol)));
    const total = assets.reduce(
      (sum, asset, idx) => sum + prices[idx] * Math.max(asset.quantity, 0),
      0,
    );
    return Number(total.toFixed(2));
  }

  buildPortfolioSeries(
    returnsByAsset: number[][],
    weights: number[],
    initialValue: number,
  ): number[] {
    const periods = Math.min(...returnsByAsset.map((assetReturns) => assetReturns.length));
    const series: number[] = [];

    let currentValue = initialValue;

    for (let t = 0; t < periods; t += 1) {
      const weightedReturn = returnsByAsset.reduce(
        (sum, assetReturns, idx) => sum + assetReturns[t] * weights[idx],
        0,
      );
      currentValue *= 1 + weightedReturn;
      series.push(Number(currentValue.toFixed(2)));
    }

    return series;
  }

  async getNews(symbols: string[]): Promise<Array<{ symbol: string; text: string }>> {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const upperSymbol = symbol.toUpperCase();
        const live = await this.finnhubService.getCompanyNews(upperSymbol);
        if (live && live.length > 0) {
          return live
            .filter((item) => item.headline || item.summary)
            .map((item) => ({ symbol: upperSymbol, text: item.summary || item.headline }));
        }

        const texts =
          this.mockNewsBySymbol[upperSymbol] ?? [
            `${upperSymbol} receives mixed analyst commentary after recent earnings.`,
            `${upperSymbol} faces changing macro conditions impacting investor sentiment.`,
          ];
        return texts.map((text) => ({ symbol: upperSymbol, text }));
      }),
    );

    return results.flat();
  }

  async getPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase();
    const live = await this.finnhubService.getQuote(upperSymbol);
    if (live !== null) {
      return live;
    }

    return this.mockPrices[upperSymbol] ?? 120;
  }

  private generateSyntheticReturns(symbol: string, periods: number): number[] {
    const seed = this.getSeed(symbol);
    const drift = ((seed % 11) - 5) / 10000;

    return Array.from({ length: periods }, (_, i) => {
      const harmonic = Math.sin((i + seed) / 8) * 0.011 + Math.cos((i + seed) / 17) * 0.007;
      const noise = Math.sin((i + 1) * 0.27 + seed) * 0.0028;
      const shockCycle = 43 + (seed % 9);
      const shock = i > 0 && i % shockCycle === 0 ? (seed % 2 === 0 ? -0.035 : 0.028) : 0;
      const value = drift + harmonic + noise + shock;

      return Number(Math.max(-0.15, Math.min(0.15, value)).toFixed(6));
    });
  }

  private getSeed(symbol: string): number {
    return symbol
      .toUpperCase()
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }
}
