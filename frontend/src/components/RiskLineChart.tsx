import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TimeSeriesPoint } from '../types';
import { Card } from './Card';

interface RiskLineChartProps {
  data: TimeSeriesPoint[];
}

export function RiskLineChart({ data }: RiskLineChartProps) {
  if (data.length === 0) {
    return (
      <Card title="Portfolio Value Trend" subtitle="Historical data will appear after analysis.">
        <p className="text-sm text-slate-500">No trend data available.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Portfolio Value Trend"
      subtitle="Synthetic historical path used for risk and anomaly context."
      headerAction={<span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{data.length} points</span>}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f6cbd" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0f6cbd" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe4ef" />
            <XAxis dataKey="day" stroke="#64748b" tickLine={false} axisLine={false} />
            <YAxis
              stroke="#64748b"
              tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString()}`}
              labelFormatter={(label) => `Day ${label}`}
              contentStyle={{
                borderRadius: '12px',
                borderColor: '#dbe4ef',
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0f6cbd"
              fill="url(#portfolioAreaGradient)"
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
