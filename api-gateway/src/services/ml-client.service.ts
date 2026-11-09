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
  method?: 'historical' | 'parametric' | 'monte_carlo';
  seed?: number;
  simulations?: number;
  weights: number[];
  asset_returns: number[][];
}

export interface RiskResponse {
  var_95: number;
  volatility: number;
  expected_shortfall: number;
  selected_method: string;
  methods: Record<
    string,
    {
      method: string;
      var: number;
      expected_shortfall: number;
      parameters: Record<string, number | string>;
    }
  >;
  model_version: string;
  deterministic_seed: number;
}

export interface AnomalyRequest {
  series: number[];
}

export interface AnomalyResponse {
  anomaly_score: number;
  is_anomaly: boolean;
  z_score: number;
}

export interface LexiconScreenRequest {
  items: Array<{
    symbol: string;
    text: string;
    source?: string;
    url?: string;
    published_at?: string;
  }>;
}

export interface LexiconScreenResponse {
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
  historical_scenarios?: Array<{
    name: string;
    period: string;
    source: string;
    asset_returns: number[][];
  }>;
}

export interface TailRiskResponse {
  var_99: number;
  cvar_99: number;
  var_975: number;
  downside_deviation: number;
  max_drawdown: number;
  skewness: number;
  kurtosis: number;
  stress_scenarios: Array<{
    name: string;
    period: string;
    source: string;
    days: number;
    terminal_return: number;
    max_loss: number;
    worst_day: number;
    method: string;
  }>;
  model_version: string;
}

export interface RegimeResponse {
  current_regime: 'bull' | 'bear' | 'stressed' | 'sideways';
  probabilities: Record<string, number>;
  features: Record<string, number>;
  model_version: string;
  method: string;
}

export interface OptimizationResponse {
  min_variance: Array<{ symbol: string; weight: number }>;
  max_sharpe: Array<{ symbol: string; weight: number }>;
  risk_parity: Array<{ symbol: string; weight: number }>;
  model_version: string;
  deterministic: boolean;
}

export interface FactorExposureRequest {
  symbols: string[];
  weights: number[];
  asset_returns: number[][];
  factor_returns: Record<string, number[]>;
}

export interface FactorExposureResponse {
  model_version: string;
  source: string;
  alpha: number;
  r_squared: number;
  exposures: Array<{ factor: string; beta: number }>;
  periods: number;
  method: string;
}

export interface VarBacktestRequest {
  weights: number[];
  asset_returns: number[][];
  confidence: number;
  window: number;
}

export interface VarBacktestResponse {
  model_version: string;
  method: string;
  confidence: number;
  window: number;
  observations: number;
  exceptions: number;
  expected_exceptions: number;
  observed_exception_rate: number;
  kupiec_pof: {
    lr_stat: number;
    passed_95: boolean;
    critical_value_95: number;
  };
  christoffersen_conditional_coverage: {
    lr_stat: number;
    passed_95: boolean;
    critical_value_95: number;
  };
  average_forecast_var: number;
  average_realized_loss: number;
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

  async screenFinancialNewsLexicon(payload: LexiconScreenRequest) {
    return this.post<LexiconScreenResponse>('/financial-lexicon-screen', payload);
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

  async calculateFactorExposures(payload: FactorExposureRequest) {
    return this.post<FactorExposureResponse>('/factor-exposures', payload);
  }

  async backtestVar(payload: VarBacktestRequest) {
    return this.post<VarBacktestResponse>('/var-backtest', payload);
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
