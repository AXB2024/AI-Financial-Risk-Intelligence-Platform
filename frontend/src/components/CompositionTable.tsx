import { PortfolioComposition } from '../types';
import { Card } from './Card';

interface CompositionTableProps {
  data: PortfolioComposition[];
}

export function CompositionTable({ data }: CompositionTableProps) {
  if (data.length === 0) {
    return (
      <Card title="Portfolio Composition" subtitle="Composition appears after analysis.">
        <p className="text-sm text-slate-500">No portfolio holdings found.</p>
      </Card>
    );
  }

  return (
    <Card title="Portfolio Composition" subtitle="Allocation snapshot used for latest risk run.">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Symbol</th>
              <th className="px-4 py-3 font-semibold">Allocation</th>
              <th className="px-4 py-3 font-semibold">Quantity</th>
              <th className="px-4 py-3 font-semibold">Price</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.symbol} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.symbol}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-700">{(row.weight * 100).toFixed(2)}%</p>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.max(0, Math.min(100, row.weight * 100))}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 font-medium text-slate-800">${row.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
