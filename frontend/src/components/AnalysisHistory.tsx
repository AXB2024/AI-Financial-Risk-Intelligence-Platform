import { AnalysisStatus } from '../types';
import { Card } from './Card';

interface AnalysisHistoryProps {
  analyses: AnalysisStatus[];
  loading: boolean;
  onSelect: (analysis: AnalysisStatus) => void;
}

export function AnalysisHistory({ analyses, loading, onSelect }: AnalysisHistoryProps) {
  return (
    <Card
      title="Analysis History"
      subtitle="Completed and queued runs are retained for comparison and backtesting workflows."
      contentClassName="space-y-3"
    >
      {loading ? <p className="text-sm text-slate-600">Loading analyses...</p> : null}

      {!loading && analyses.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No analyses have been run for this portfolio.
        </p>
      ) : null}

      {analyses.map((analysis) => (
        <button
          key={analysis.id}
          type="button"
          onClick={() => onSelect(analysis)}
          disabled={analysis.status !== 'completed'}
          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
            analysis.status === 'completed'
              ? 'border-slate-200 bg-white hover:border-slate-300'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-950">
              {new Date(analysis.createdAt).toLocaleString()}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-600">
              {analysis.status}
            </span>
          </span>
          {analysis.result ? (
            <span className="mt-1 block text-xs text-slate-500">
              VaR {(analysis.result.var95 * 100).toFixed(2)}% · Volatility{' '}
              {(analysis.result.volatility * 100).toFixed(2)}%
            </span>
          ) : null}
        </button>
      ))}
    </Card>
  );
}
