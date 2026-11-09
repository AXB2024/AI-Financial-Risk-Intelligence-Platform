import axios from 'axios';
import {
  AnalysisComparison,
  AnalysisStatus,
  AuthResponse,
  BacktestResponse,
  CreatePortfolioRequest,
  PortfolioResponse,
  RiskResponse,
  TenantBranding,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  timeout: 10000,
  withCredentials: true,
});

const AUTH_UNAUTHORIZED_EVENT = 'risk-platform-auth-unauthorized';
let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = axios.isAxiosError(error) ? error.config : undefined;
    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/login') || originalRequest?.url?.startsWith('/auth/register') || originalRequest?.url?.startsWith('/auth/refresh');

    if (axios.isAxiosError(error) && error.response?.status === 401 && originalRequest && !isAuthEndpoint && !(originalRequest as { _retry?: boolean })._retry) {
      (originalRequest as { _retry?: boolean })._retry = true;
      refreshPromise ??= api.post('/auth/refresh').then(() => undefined).finally(() => {
        refreshPromise = null;
      });
      try {
        await refreshPromise;
        return api(originalRequest);
      } catch {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    } else if (axios.isAxiosError(error) && error.response?.status === 401) {
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  },
);

export function onUnauthorized(handler: () => void) {
  window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handler);
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }

    if (typeof message === 'string') {
      return message;
    }

    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', payload);
  return response.data;
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', payload);
  return response.data;
}

export async function getMe(): Promise<AuthResponse['user']> {
  const response = await api.get<{ user: AuthResponse['user'] }>('/auth/me');
  return response.data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function getTenantBranding(): Promise<TenantBranding> {
  const response = await api.get<TenantBranding>('/api/v1/branding/current');
  return response.data;
}

export async function createPortfolio(payload: CreatePortfolioRequest): Promise<PortfolioResponse> {
  const response = await api.post<PortfolioResponse>('/portfolio', payload);
  return response.data;
}

export async function listPortfolios(): Promise<PortfolioResponse[]> {
  const response = await api.get<PortfolioResponse[]>('/portfolios');
  return response.data;
}

export async function getRisk(portfolioId: string): Promise<RiskResponse> {
  const response = await api.get<RiskResponse>(`/risk/${portfolioId}`);
  return response.data;
}

export async function createAnalysis(portfolioId: string): Promise<AnalysisStatus> {
  const response = await api.post<AnalysisStatus>('/analyses', { portfolioId });
  return response.data;
}

export async function getAnalysis(analysisId: string): Promise<AnalysisStatus> {
  const response = await api.get<AnalysisStatus>(`/analyses/${analysisId}`);
  return response.data;
}

export async function listAnalyses(portfolioId: string): Promise<AnalysisStatus[]> {
  const response = await api.get<AnalysisStatus[]>(`/portfolios/${portfolioId}/analyses`);
  return response.data;
}

export async function compareAnalyses(
  portfolioId: string,
  from: string,
  to: string,
): Promise<AnalysisComparison> {
  const response = await api.get<AnalysisComparison>(`/portfolios/${portfolioId}/analyses/compare`, {
    params: { from, to },
  });
  return response.data;
}

export async function getBacktest(portfolioId: string, periods = 180): Promise<BacktestResponse> {
  const response = await api.get<BacktestResponse>(`/portfolios/${portfolioId}/backtest`, {
    params: { periods },
  });
  return response.data;
}
