import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SentimentResult } from '../types';
import { Card } from './Card';

interface SentimentBarChartProps {
  data: SentimentResult[];
}

const sentimentColor: Record<SentimentResult['label'], string> = {
  positive: '#178a55',
  neutral: '#0f6cbd',
  negative: '#c13f35',
};

export function SentimentBarChart({ data }: SentimentBarChartProps) {
  if (data.length === 0) {
    return (
      <Card title="News Sentiment by Symbol" subtitle="Sentiment values appear after analysis.">
        <p className="text-sm text-slate-500">No sentiment records available.</p>
      </Card>
    );
  }

  return (
    <Card title="News Sentiment by Symbol" subtitle="Lexicon-based sentiment score per stock symbol.">
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe4ef" />
            <XAxis dataKey="symbol" stroke="#64748b" tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" domain={[-1, 1]} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                borderColor: '#dbe4ef',
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Bar dataKey="score" radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.symbol} fill={sentimentColor[entry.label]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
          <span className="size-2 rounded-full bg-emerald-600" /> Positive
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
          <span className="size-2 rounded-full bg-blue-600" /> Neutral
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
          <span className="size-2 rounded-full bg-rose-600" /> Negative
        </span>
      </div>
    </Card>
  );
}
