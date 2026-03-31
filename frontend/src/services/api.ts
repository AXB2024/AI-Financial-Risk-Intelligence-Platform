import axios from 'axios';
import { CreatePortfolioRequest, PortfolioResponse, RiskResponse } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  timeout: 10000,
});

export async function createPortfolio(payload: CreatePortfolioRequest): Promise<PortfolioResponse> {
  const response = await api.post<PortfolioResponse>('/portfolio', payload);
  return response.data;
}

export async function getRisk(portfolioId: string): Promise<RiskResponse> {
  const response = await api.get<RiskResponse>(`/risk/${portfolioId}`);
  return response.data;
}
