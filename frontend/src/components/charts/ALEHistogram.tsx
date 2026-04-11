import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';
import { formatCurrency } from '../../utils/formatting';

interface Props {
  samples: number[];
  mean: number;
  median: number;
  p90: number;
  p95: number;
}

const BINS = 50;

function buildHistogram(samples: number[]): { x: number; count: number; cumPct: number }[] {
  if (!samples.length) return [];
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) return [{ x: min, count: samples.length, cumPct: 100 }];

  // Use 95th percentile as upper bound for display (remove outliers)
  const p95Idx = Math.floor(0.95 * sorted.length);
  const displayMax = sorted[p95Idx];
  const step = (displayMax - min) / BINS;

  const bins = Array.from({ length: BINS }, (_, i) => ({ x: min + i * step, count: 0, cumPct: 0 }));
  let cumCount = 0;
  for (const v of sorted) {
    const idx = Math.min(Math.floor((v - min) / step), BINS - 1);
    if (idx >= 0 && idx < BINS) bins[idx].count++;
  }
  for (let i = 0; i < BINS; i++) {
    cumCount += bins[i].count;
    bins[i].cumPct = (cumCount / samples.length) * 100;
  }
  return bins;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const { x, count, cumPct } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs">
      <p className="font-medium">{formatCurrency(x)}</p>
      <p className="text-gray-600">Frequency: {count.toLocaleString()} simulations</p>
      <p className="text-gray-600">Cumulative: {cumPct.toFixed(1)}%</p>
    </div>
  );
};

export function ALEHistogram({ samples, mean, median, p90, p95 }: Props) {
  const data = buildHistogram(samples);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="x"
            tickFormatter={v => formatCurrency(v, true)}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Simulations" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.x >= p90 ? '#ef4444' : entry.x >= p95 * 0.5 ? '#f97316' : '#0ea5e9'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
          <ReferenceLine x={mean}   stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" label={{ value: 'Mean', fill: '#ef4444', fontSize: 10, position: 'top' }} />
          <ReferenceLine x={median} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" label={{ value: 'P50',  fill: '#3b82f6', fontSize: 10, position: 'top' }} />
          <ReferenceLine x={p90}    stroke="#f97316" strokeWidth={1} strokeDasharray="3 3" label={{ value: 'P90',  fill: '#f97316', fontSize: 10, position: 'top' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
