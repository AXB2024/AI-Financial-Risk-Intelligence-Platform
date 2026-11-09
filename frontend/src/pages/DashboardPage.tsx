import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AlertBanner } from '../components/AlertBanner';
import { AnalysisHistory } from '../components/AnalysisHistory';
import { CompositionTable } from '../components/CompositionTable';
import { DashboardHeader } from '../components/DashboardHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MetricCard } from '../components/MetricCard';
import { PortfolioForm } from '../components/PortfolioForm';
import { PremiumAnalyticsPanel } from '../components/PremiumAnalyticsPanel';
import { RiskLineChart } from '../components/RiskLineChart';
import { SavedPortfolios } from '../components/SavedPortfolios';
import { LexiconScreenChart } from '../components/LexiconScreenChart';
import {
  createAnalysis,
  createPortfolio,
  getAnalysis,
  getApiErrorMessage,
  getTenantBranding,
  listAnalyses,
  listPortfolios,
} from '../services/api';
import { AnalysisStatus, PortfolioAssetInput, PortfolioResponse, RiskResponse, TenantBranding } from '../types';

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [savedPortfolios, setSavedPortfolios] = useState<PortfolioResponse[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisStatus[]>([]);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [portfolioListLoading, setPortfolioListLoading] = useState(false);
  const [analysisListLoading, setAnalysisListLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSavedPortfolios = async () => {
    setPortfolioListLoading(true);
    try {
      setSavedPortfolios(await listPortfolios());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPortfolioListLoading(false);
    }
  };

  useEffect(() => {
    void refreshSavedPortfolios();
    getTenantBranding().then(setBranding).catch(() => undefined);
  }, []);

  const refreshAnalyses = async (portfolioId: string) => {
    setAnalysisListLoading(true);
    try {
      setAnalyses(await listAnalyses(portfolioId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setAnalysisListLoading(false);
    }
  };

  const waitForAnalysis = async (analysisId: string): Promise<RiskResponse> => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const status = await getAnalysis(analysisId);
      setAnalysisStatus(status.status);

      if (status.status === 'completed' && status.result) {
        return status.result;
      }

      if (status.status === 'failed') {
        throw new Error(status.errorMessage ?? 'Analysis failed');
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error('Analysis is still running. Check the analysis history in a moment.');
  };

  const enqueueAnalysis = async (portfolioId: string) => {
    const analysis = await createAnalysis(portfolioId);
    setAnalysisStatus(analysis.status);
    await refreshAnalyses(portfolioId);

    if (analysis.status === 'completed' && analysis.result) {
      return analysis.result;
    }

    const result = await waitForAnalysis(analysis.id);
    await refreshAnalyses(portfolioId);
    return result;
  };

  const runAnalysis = async (name: string, assets: PortfolioAssetInput[]) => {
    try {
      setLoading(true);
      setError(null);
      setAnalysisStatus('queued');

      const savedPortfolio = await createPortfolio({ name, assets });
      setPortfolio(savedPortfolio);

      const riskResult = await enqueueAnalysis(savedPortfolio.id);
      setRisk(riskResult);
      await refreshSavedPortfolios();
    } catch (err) {
      setError(getApiErrorMessage(err));
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
      setAnalysisStatus(null);
    }
  };

  const runSavedAnalysis = async (savedPortfolio: PortfolioResponse) => {
    try {
      setLoading(true);
      setError(null);
      setAnalysisStatus('queued');
      setPortfolio(savedPortfolio);
      setRisk(await enqueueAnalysis(savedPortfolio.id));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setAnalysisStatus(null);
    }
  };

  const selectHistoricalAnalysis = (analysis: AnalysisStatus) => {
    if (!analysis.result) {
      return;
    }

    setRisk(analysis.result);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <DashboardHeader
        generatedAt={risk?.generatedAt}
        userName={user?.name ?? 'User'}
        userTier={user?.tier ?? 'free'}
        tenantName={branding?.tenantName ?? user?.tenantSlug}
        tenantRole={user?.tenantRole}
        onSignOut={signOut}
      />

      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <PortfolioForm loading={loading} onSubmit={runAnalysis} />
          <SavedPortfolios
            portfolios={savedPortfolios}
            activePortfolioId={portfolio?.id}
            loading={portfolioListLoading}
            onSelect={(savedPortfolio) => {
              setPortfolio(savedPortfolio);
              void refreshAnalyses(savedPortfolio.id);
              void runSavedAnalysis(savedPortfolio);
            }}
          />
          {portfolio ? (
            <AnalysisHistory
              analyses={analyses}
              loading={analysisListLoading}
              onSelect={selectHistoricalAnalysis}
            />
          ) : null}

          {portfolio ? (
            <p className="surface-card px-4 py-3 text-sm font-medium text-slate-700">
              Active Portfolio: <span className="font-semibold text-slate-900">{portfolio.name}</span>
              {analysisStatus ? (
                <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs uppercase text-blue-700">
                  {analysisStatus}
                </span>
              ) : null}
            </p>
          ) : null}

          {error ? <AlertBanner message={error} /> : null}
        </div>

        <div className="space-y-6 xl:col-span-8">
          {loading && !risk ? <LoadingState /> : null}

          {risk ? (
            <>
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Portfolio Value"
                  value={`$${risk.portfolioValue.toLocaleString()}`}
                  hint="Current notional"
                />
                <MetricCard
                  label="VaR (95%)"
                  value={`${(risk.var95 * 100).toFixed(2)}%`}
                  tone="alert"
                  hint="Potential downside"
                />
                <MetricCard
                  label="Volatility"
                  value={`${(risk.volatility * 100).toFixed(2)}%`}
                  hint="Return dispersion"
                />
                <MetricCard
                  label="Anomaly Signal"
                  value={risk.anomaly.detected ? 'Detected' : 'Normal'}
                  tone={risk.anomaly.detected ? 'alert' : 'success'}
                  hint={`z-score ${risk.anomaly.zScore.toFixed(2)}`}
                />
              </section>

              <RiskLineChart data={risk.timeseries} />
              <PremiumAnalyticsPanel analytics={risk.premiumAnalytics} />
              <LexiconScreenChart data={risk.sentiment} />
              <CompositionTable data={risk.composition} />
            </>
          ) : (
            !loading && <EmptyState />
          )}
        </div>
      </section>
    </main>
  );
}
