import { useState } from 'react';
import { AlertBanner } from '../components/AlertBanner';
import { CompositionTable } from '../components/CompositionTable';
import { DashboardHeader } from '../components/DashboardHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MetricCard } from '../components/MetricCard';
import { PortfolioForm } from '../components/PortfolioForm';
import { RiskLineChart } from '../components/RiskLineChart';
import { SentimentBarChart } from '../components/SentimentBarChart';
import { createPortfolio, getRisk } from '../services/api';
import { PortfolioAssetInput, PortfolioResponse, RiskResponse } from '../types';

export function DashboardPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (name: string, assets: PortfolioAssetInput[]) => {
    try {
      setLoading(true);
      setError(null);

      const savedPortfolio = await createPortfolio({ name, assets });
      setPortfolio(savedPortfolio);

      const riskResult = await getRisk(savedPortfolio.id);
      setRisk(riskResult);
    } catch (err) {
      setError('Unable to complete analysis. Verify that API Gateway and ML Service are running.');
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <DashboardHeader generatedAt={risk?.generatedAt} />

      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <PortfolioForm loading={loading} onSubmit={runAnalysis} />

          {portfolio ? (
            <p className="surface-card px-4 py-3 text-sm font-medium text-slate-700">
              Active Portfolio: <span className="font-semibold text-slate-900">{portfolio.name}</span>
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
              <SentimentBarChart data={risk.sentiment} />
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
