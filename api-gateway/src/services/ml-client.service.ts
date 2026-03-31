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
  }>;
}

export interface SentimentResponse {
  results: Array<{
    symbol: string;
    score: number;
    label: 'positive' | 'neutral' | 'negative';
  }>;
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
