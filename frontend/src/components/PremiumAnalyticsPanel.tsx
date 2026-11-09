import { PremiumAnalytics } from '../types';
import { Card } from './Card';

interface PremiumAnalyticsPanelProps {
  analytics?: PremiumAnalytics | null;
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function PremiumAnalyticsPanel({ analytics }: PremiumAnalyticsPanelProps) {
  if (!analytics) {
    return null;
  }

  const tailRisk = analytics.tailRisk;
  const regime = analytics.regime;
  const optimization = analytics.optimization;
  const financialLexiconScreens = analytics.financialSentiment ?? [];
  const factorExposures = analytics.factorExposures;
  const varBacktest = analytics.varBacktest;

  return (
    <Card
      title="Premium Risk Intelligence"
      subtitle="Tail exposure, regime context, optimized allocations, and finance-domain lexicon screening."
      contentClassName="space-y-6"
    >
      {tailRisk ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="VaR 99%" value={percent(tailRisk.var_99)} />
            <Metric label="CVaR 99%" value={percent(tailRisk.cvar_99)} />
            <Metric label="Max Drawdown" value={percent(tailRisk.max_drawdown)} />
            <Metric label="Downside Dev." value={percent(tailRisk.downside_deviation)} />
          </div>
          {tailRisk.stress_scenarios.length > 0 ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-950">Historical Stress Replay</h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {tailRisk.stress_scenarios.map((scenario) => (
                  <div key={scenario.name} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{scenario.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{scenario.period}</p>
                      </div>
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        {percent(scenario.max_loss)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <MiniMetric label="Days" value={String(scenario.days)} />
                      <MiniMetric label="Terminal" value={percent(scenario.terminal_return)} />
                      <MiniMetric label="Worst Day" value={percent(scenario.worst_day)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {varBacktest ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">VaR Backtesting</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
              Kupiec {varBacktest.kupiec_pof.passed_95 ? 'Pass' : 'Review'} / Christoffersen{' '}
              {varBacktest.christoffersen_conditional_coverage.passed_95 ? 'Pass' : 'Review'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Exceptions" value={`${varBacktest.exceptions}/${varBacktest.observations}`} />
            <Metric label="Expected" value={varBacktest.expected_exceptions.toFixed(1)} />
            <Metric label="Observed Rate" value={percent(varBacktest.observed_exception_rate)} />
            <Metric label="Avg Forecast VaR" value={percent(varBacktest.average_forecast_var)} />
          </div>
        </section>
      ) : null}

      {factorExposures && factorExposures.exposures.length > 0 ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">Factor Exposures</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              R2 {(factorExposures.r_squared * 100).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {factorExposures.exposures.map((exposure) => (
              <MiniMetric key={exposure.factor} label={exposure.factor.toUpperCase()} value={exposure.beta.toFixed(2)} />
            ))}
          </div>
        </section>
      ) : null}

      {regime ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">Market Regime</h3>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
              {regime.current_regime}
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(regime.probabilities).map(([name, probability]) => (
              <div key={name}>
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                  <span className="capitalize">{name}</span>
                  <span>{percent(probability)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.min(100, probability * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {optimization ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-950">Suggested Allocations</h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Allocation title="Min Variance" weights={optimization.min_variance} />
            <Allocation title="Max Sharpe" weights={optimization.max_sharpe} />
            <Allocation title="Risk Parity" weights={optimization.risk_parity} />
          </div>
        </section>
      ) : null}

      {financialLexiconScreens.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-950">Financial News Lexicon Screen</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {financialLexiconScreens.map((item) => (
              <div key={`${item.symbol}-${item.source ?? 'source'}`} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-950">{item.symbol}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-600">
                    {item.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Lexicon confidence {percent(item.confidence ?? 0.5)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.themes ?? ['market']).map((theme) => (
                    <span key={theme} className="rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Allocation({
  title,
  weights,
}: {
  title: string;
  weights: Array<{ symbol: string; weight: number }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-3 text-xs font-bold uppercase text-slate-500">{title}</p>
      <div className="space-y-2">
        {weights.map((item) => (
          <div key={`${title}-${item.symbol}`}>
            <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
              <span>{item.symbol}</span>
              <span>{percent(item.weight)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-600"
                style={{ width: `${Math.min(100, item.weight * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
