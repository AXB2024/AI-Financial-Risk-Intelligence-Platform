export interface PortfolioAssetInput {
  symbol: string;
  weight: number;
  quantity: number;
}

export type UserTier = 'free' | 'pro' | 'team' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  tenantId: string;
  tenantSlug: string;
  tenantRole: 'owner' | 'admin' | 'analyst' | 'viewer' | 'developer';
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface CreatePortfolioRequest {
  name: string;
  assets: PortfolioAssetInput[];
}

export interface PortfolioResponse {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assets: PortfolioAssetInput[];
}

export interface TenantBranding {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  supportEmail: string | null;
  legalDisclaimer: string | null;
  updatedAt: string;
}

export interface SentimentResult {
  symbol: string;
  score: number;
  label: 'positive' | 'neutral' | 'negative';
  confidence?: number;
  themes?: string[];
  source?: string;
}

export interface PortfolioComposition {
  symbol: string;
  weight: number;
  quantity: number;
  price: number;
}

export interface TimeSeriesPoint {
  day: number;
  value: number;
}

export interface RiskResponse {
  analysisId?: string;
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
  sentiment: SentimentResult[];
  composition: PortfolioComposition[];
  timeseries: TimeSeriesPoint[];
  premiumAnalytics?: PremiumAnalytics | null;
  generatedAt: string;
}

export interface PremiumAnalytics {
  tailRisk?: {
    var_99: number;
    cvar_99: number;
    var_975: number;
    downside_deviation: number;
    max_drawdown: number;
    skewness: number;
    kurtosis: number;
    stress_scenarios: Array<{ name: string; shock: number; estimated_loss: number }>;
    model: string;
  };
  regime?: {
    current_regime: 'bull' | 'bear' | 'stressed' | 'sideways';
    probabilities: Record<string, number>;
    features: Record<string, number>;
    model: string;
  };
  optimization?: {
    min_variance: Array<{ symbol: string; weight: number }>;
    max_sharpe: Array<{ symbol: string; weight: number }>;
    risk_parity: Array<{ symbol: string; weight: number }>;
    model: string;
  };
  financialSentiment?: SentimentResult[];
}

export type AnalysisStatusValue = 'pending' | 'processing' | 'completed' | 'failed';

export interface AnalysisStatus {
  id: string;
  portfolioId: string;
  status: AnalysisStatusValue;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  result: RiskResponse | null;
}

export interface AnalysisComparison {
  portfolioId: string;
  from: RiskResponse;
  to: RiskResponse;
  delta: {
    portfolioValue: number;
    var95: number;
    volatility: number;
    expectedShortfall: number;
    anomalyScore: number;
  };
}

export interface BacktestResponse {
  portfolioId: string;
  portfolioName: string;
  periods: number;
  initialValue: number;
  endingValue: number;
  cumulativeReturn: number;
  maxDrawdown: number;
  series: TimeSeriesPoint[];
}
