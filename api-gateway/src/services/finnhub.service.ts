import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { RedisCacheService } from './redis-cache.service';

export interface FinnhubNewsItem {
  headline: string;
  summary: string;
  datetime: number;
  source: string;
  url: string;
}

interface FinnhubQuoteResponse {
  c: number; // current price
}

interface FinnhubCandleResponse {
  c: number[]; // close prices
  s: string; // status: 'ok' | 'no_data'
}

const QUOTE_TTL_SECONDS = 30;
const CANDLE_TTL_SECONDS = 60 * 60 * 6;
const NEWS_TTL_SECONDS = 60 * 15;

@Injectable()
export class FinnhubService {
  private readonly logger = new Logger(FinnhubService.name);
  private readonly baseUrl = 'https://finnhub.io/api/v1';
  private readonly apiKey?: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: RedisCacheService,
  ) {
    this.apiKey = this.configService.get<string>('FINNHUB_API_KEY') || undefined;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async getQuote(symbol: string): Promise<number | null> {
    if (!this.apiKey) {
      return null;
    }

    const cacheKey = `finnhub:quote:${symbol}`;
    const cached = await this.cacheService.getJson<{ price: number }>(cacheKey);
    if (cached) {
      return cached.price;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<FinnhubQuoteResponse>(`${this.baseUrl}/quote`, {
          params: { symbol, token: this.apiKey },
          timeout: 5000,
        }),
      );

      if (!data || typeof data.c !== 'number' || data.c <= 0) {
        return null;
      }

      await this.cacheService.setJson(cacheKey, { price: data.c }, QUOTE_TTL_SECONDS);
      return data.c;
    } catch (error) {
      this.logWarning('quote', symbol, error);
      return null;
    }
  }

  async getDailyReturns(symbol: string, periods: number): Promise<number[] | null> {
    if (!this.apiKey) {
      return null;
    }

    const cacheKey = `finnhub:candles:${symbol}:${periods}`;
    const cached = await this.cacheService.getJson<{ returns: number[] }>(cacheKey);
    if (cached) {
      return cached.returns;
    }

    const to = Math.floor(Date.now() / 1000);
    const from = to - (periods + 10) * 24 * 60 * 60;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<FinnhubCandleResponse>(`${this.baseUrl}/stock/candle`, {
          params: { symbol, resolution: 'D', from, to, token: this.apiKey },
          timeout: 5000,
        }),
      );

      if (!data || data.s !== 'ok' || !Array.isArray(data.c) || data.c.length < 2) {
        return null;
      }

      const returns: number[] = [];
      for (let i = 1; i < data.c.length; i += 1) {
        const prevClose = data.c[i - 1];
        if (prevClose > 0) {
          returns.push(Number(((data.c[i] - prevClose) / prevClose).toFixed(6)));
        }
      }

      const sliced = returns.slice(-periods);
      await this.cacheService.setJson(cacheKey, { returns: sliced }, CANDLE_TTL_SECONDS);
      return sliced;
    } catch (error) {
      this.logWarning('candle', symbol, error);
      return null;
    }
  }

  async getCompanyNews(symbol: string): Promise<FinnhubNewsItem[] | null> {
    if (!this.apiKey) {
      return null;
    }

    const cacheKey = `finnhub:news:${symbol}`;
    const cached = await this.cacheService.getJson<{ items: FinnhubNewsItem[] }>(cacheKey);
    if (cached) {
      return cached.items;
    }

    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<FinnhubNewsItem[]>(`${this.baseUrl}/company-news`, {
          params: {
            symbol,
            from: this.formatDate(from),
            to: this.formatDate(to),
            token: this.apiKey,
          },
          timeout: 5000,
        }),
      );

      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      const items = data.slice(0, 5);
      await this.cacheService.setJson(cacheKey, { items }, NEWS_TTL_SECONDS);
      return items;
    } catch (error) {
      this.logWarning('news', symbol, error);
      return null;
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private logWarning(kind: string, symbol: string, error: unknown) {
    const message =
      error instanceof AxiosError
        ? `${error.response?.status ?? 'network error'} ${error.message}`
        : (error as Error).message;
    this.logger.warn(`Finnhub ${kind} lookup failed for ${symbol}, falling back to synthetic data: ${message}`);
  }
}
