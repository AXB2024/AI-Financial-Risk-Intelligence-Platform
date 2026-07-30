import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface RiskRequest {
  confidence: number;
  weights: number[];
  asset_returns: number[][];
}

export interface RiskResponse {
  var_95: number;
  volatility: number;
  expected_shortfall: number;
}

export interface AnomalyRequest {
  series: number[];
}

export interface AnomalyResponse {
  anomaly_score: number;
  is_anomaly: boolean;
  z_score: number;
}

export interface SentimentRequest {
  items: Array<{
    symbol: string;
    text: string;
    source?: string;
    url?: string;
    published_at?: string;
  }>;
}

export interface SentimentResponse {
  results: Array<{
    symbol: string;
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    confidence?: number;
    themes?: string[];
    source?: string;
    url?: string | null;
    published_at?: string | null;
  }>;
}

export interface AdvancedAnalyticsRequest {
  symbols: string[];
  weights: number[];
  asset_returns: number[][];
}

export interface TailRiskResponse {
  var_99: number;
  cvar_99: number;
  var_975: number;
  downside_deviation: number;
  max_drawdown: number;
  skewness: number;
  kurtosis: number;
  stress_scenarios: Array<{ name: string; shock: number; estimated_loss: number }>;
  model: string;
}

export interface RegimeResponse {
  current_regime: 'bull' | 'bear' | 'stressed' | 'sideways';
  probabilities: Record<string, number>;
  features: Record<string, number>;
  model: string;
}

export interface OptimizationResponse {
  min_variance: Array<{ symbol: string; weight: number }>;
  max_sharpe: Array<{ symbol: string; weight: number }>;
  risk_parity: Array<{ symbol: string; weight: number }>;
  model: string;
}

@Injectable()
export class MlClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async calculateRisk(payload: RiskRequest) {
    return this.post<RiskResponse>('/risk', payload);
  }

  async detectAnomaly(payload: AnomalyRequest) {
    return this.post<AnomalyResponse>('/anomaly', payload);
  }

  async analyzeSentiment(payload: SentimentRequest) {
    return this.post<SentimentResponse>('/sentiment', payload);
  }

  async analyzeFinancialSentiment(payload: SentimentRequest) {
    return this.post<SentimentResponse>('/financial-sentiment', payload);
  }

  async calculateTailRisk(payload: AdvancedAnalyticsRequest) {
    return this.post<TailRiskResponse>('/advanced-risk', payload);
  }

  async detectMarketRegime(payload: AdvancedAnalyticsRequest) {
    return this.post<RegimeResponse>('/regime', payload);
  }

  async optimizePortfolio(payload: AdvancedAnalyticsRequest) {
    return this.post<OptimizationResponse>('/optimize', payload);
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const baseUrl = this.configService.get<string>('ML_SERVICE_URL', 'http://localhost:8000');

    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(`${baseUrl}${path}`, payload, {
          timeout: 8000,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      if (typeof error === 'object' && error && 'response' in error) {
        throw new InternalServerErrorException(`ML service returned an error for ${path}`);
      }

      throw new ServiceUnavailableException('ML service is unavailable');
    }
  }
}
