import { Injectable } from '@nestjs/common';
import { decimal } from '../utils/round.util';
import { FinnhubService } from './finnhub.service';

interface AssetForPricing {
  symbol: string;
  quantity: number;
  weight: number;
}

const MIN_LIVE_RETURNS_RATIO = 0.5;
const FACTOR_NAMES = ['mkt_rf', 'smb', 'hml', 'rmw', 'cma', 'mom'] as const;

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

  async getHistoricalScenarioReturns(symbols: string[]) {
    const episodes = [
      {
        name: 'GFC 2008',
        period: '2008-09-15 to 2009-03-09',
        from: '2008-09-15',
        to: '2009-03-09',
        days: 126,
        severity: 1.45,
        rebound: 0.18,
      },
      {
        name: 'March 2020 COVID Shock',
        period: '2020-02-19 to 2020-03-23',
        from: '2020-02-19',
        to: '2020-03-23',
        days: 24,
        severity: 1.85,
        rebound: 0.34,
      },
      {
        name: '2022 Rate Shock',
        period: '2022-01-03 to 2022-10-14',
        from: '2022-01-03',
        to: '2022-10-14',
        days: 198,
        severity: 0.95,
        rebound: 0.06,
      },
      {
        name: 'Feb 2018 Volmageddon',
        period: '2018-02-01 to 2018-02-09',
        from: '2018-02-01',
        to: '2018-02-09',
        days: 7,
        severity: 1.25,
        rebound: 0.12,
      },
    ];

    return Promise.all(
      episodes.map(async (episode) => {
        const liveReturns = await Promise.all(
          symbols.map((symbol) =>
            this.finnhubService.getDailyReturnsForRange(symbol.toUpperCase(), episode.from, episode.to),
          ),
        );
        const hasCompleteLiveWindow = liveReturns.every((returns) => returns && returns.length >= 4);
        const assetReturns = hasCompleteLiveWindow
          ? this.alignReturnVectors(liveReturns as number[][])
          : symbols.map((symbol) =>
              this.generateHistoricalEpisodePath(symbol, episode.days, episode.severity, episode.rebound),
            );

        return {
          name: episode.name,
          period: episode.period,
          source: hasCompleteLiveWindow ? 'finnhub_daily_candles' : 'deterministic_local_fallback',
          asset_returns: assetReturns,
        };
      }),
    );
  }

  async getFactorReturns(periods: number): Promise<Record<string, number[]>> {
    return FACTOR_NAMES.reduce<Record<string, number[]>>((result, factorName, idx) => {
      result[factorName] = this.generateDeterministicFactorReturns(factorName, periods, idx);
      return result;
    }, {});
  }

  async calculatePortfolioValue(assets: AssetForPricing[]): Promise<number> {
    const hasExplicitQuantities = assets.some((asset) => asset.quantity > 0);
    if (!hasExplicitQuantities) {
      return 100000;
    }

    const prices = await Promise.all(assets.map((asset) => this.getPrice(asset.symbol)));
    const total = assets.reduce(
      (sum, asset, idx) => sum.plus(decimal(prices[idx]).times(Math.max(asset.quantity, 0))),
      decimal(0),
    );
    return total.toDecimalPlaces(10).toNumber();
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
      series.push(decimal(currentValue).toDecimalPlaces(10).toNumber());
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
            `${upperSymbol} faces changing macro conditions impacting investor positioning.`,
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

  private generateHistoricalEpisodePath(
    symbol: string,
    days: number,
    severity: number,
    rebound: number,
  ): number[] {
    const seed = this.getSeed(symbol);
    const beta = 0.75 + (seed % 9) / 10;
    const qualityOffset = ((seed % 7) - 3) / 1000;

    return Array.from({ length: days }, (_, i) => {
      const progress = days === 1 ? 1 : i / (days - 1);
      const selloffWave = -0.012 * severity * beta * Math.exp(-Math.pow((progress - 0.35) / 0.28, 2));
      const liquidityGap = i % Math.max(3, Math.floor(days / 9)) === 0 ? -0.018 * severity * beta : 0;
      const reboundWave = progress > 0.68 ? 0.006 * rebound * beta * Math.sin(progress * Math.PI) : 0;
      const idiosyncratic = Math.sin(seed * 0.17 + i * 0.61) * 0.0025 + qualityOffset;
      const value = selloffWave + liquidityGap + reboundWave + idiosyncratic;

      return Number(Math.max(-0.28, Math.min(0.18, value)).toFixed(6));
    });
  }

  private generateDeterministicFactorReturns(
    factorName: (typeof FACTOR_NAMES)[number],
    periods: number,
    index: number,
  ): number[] {
    const seed = this.getSeed(factorName);
    return Array.from({ length: periods }, (_, i) => {
      const cycle = Math.sin((i + seed) / (11 + index)) * (0.0035 + index * 0.0002);
      const macro = Math.cos((i + 1) / (29 - index)) * (0.0025 + index * 0.0001);
      const episodic = i > 0 && i % (61 + index * 3) === 0 ? -0.012 + index * 0.001 : 0;
      return Number((cycle + macro + episodic).toFixed(6));
    });
  }

  private alignReturnVectors(returnsByAsset: number[][]): number[][] {
    const periods = Math.min(...returnsByAsset.map((returns) => returns.length));
    return returnsByAsset.map((returns) => returns.slice(-periods));
  }

  private getSeed(symbol: string): number {
    return symbol
      .toUpperCase()
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }
}
