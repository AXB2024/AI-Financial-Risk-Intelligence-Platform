export interface PortfolioAssetInput {
  symbol: string;
  weight: number;
  quantity: number;
}

export interface CreatePortfolioRequest {
  name: string;
  assets: PortfolioAssetInput[];
}

export interface PortfolioResponse {
  id: string;
  name: string;
  createdAt: string;
  assets: PortfolioAssetInput[];
}

export interface SentimentResult {
  symbol: string;
  score: number;
  label: 'positive' | 'neutral' | 'negative';
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
  generatedAt: string;
}
