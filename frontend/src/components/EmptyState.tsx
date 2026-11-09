import { Card } from './Card';

export function EmptyState() {
  return (
    <Card
      title="Dashboard Ready"
      subtitle="Submit a portfolio to generate risk, anomaly, and lexicon-screen outputs."
      className="min-h-[240px]"
      contentClassName="flex h-full items-center"
    >
      <ul className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <li className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">VaR and expected shortfall</li>
        <li className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">Behavior anomaly checks</li>
        <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">News lexicon screen by symbol</li>
      </ul>
    </Card>
  );
}
