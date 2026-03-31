import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'alert' | 'success';
  hint?: string;
}

export function MetricCard({ label, value, tone = 'default', hint }: MetricCardProps) {
  const valueClass =
    tone === 'alert'
      ? 'text-rose-600'
      : tone === 'success'
        ? 'text-emerald-700'
        : 'text-slate-900';

  const badgeClass =
    tone === 'alert'
      ? 'bg-rose-50 text-rose-700'
      : tone === 'success'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-blue-50 text-blue-700';

  return (
    <Card className="h-full" contentClassName="space-y-3">
      <p className="section-label">{label}</p>
      <p className={`metric-value ${valueClass}`}>{value}</p>
      {hint ? <p className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{hint}</p> : null}
    </Card>
  );
}
