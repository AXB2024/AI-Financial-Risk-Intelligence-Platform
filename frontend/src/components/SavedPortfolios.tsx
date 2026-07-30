import { PortfolioResponse } from '../types';
import { Card } from './Card';

interface SavedPortfoliosProps {
  portfolios: PortfolioResponse[];
  activePortfolioId?: string;
  loading: boolean;
  onSelect: (portfolio: PortfolioResponse) => void;
}

export function SavedPortfolios({
  portfolios,
  activePortfolioId,
  loading,
  onSelect,
}: SavedPortfoliosProps) {
  return (
    <Card
      title="Saved Portfolios"
      subtitle="Return to prior work and rerun analysis without rebuilding inputs."
      contentClassName="space-y-3"
    >
      {loading ? <p className="text-sm text-slate-600">Loading saved portfolios...</p> : null}

      {!loading && portfolios.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No saved portfolios yet.
        </p>
      ) : null}

      {portfolios.map((portfolio) => (
        <button
          key={portfolio.id}
          type="button"
          onClick={() => onSelect(portfolio)}
          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
            activePortfolioId === portfolio.id
              ? 'border-blue-300 bg-blue-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <span className="block text-sm font-semibold text-slate-950">{portfolio.name}</span>
          <span className="mt-1 block text-xs text-slate-500">
            {portfolio.assets.length} assets · Updated {new Date(portfolio.updatedAt).toLocaleDateString()}
          </span>
        </button>
      ))}
    </Card>
  );
}
