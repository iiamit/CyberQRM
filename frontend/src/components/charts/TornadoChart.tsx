import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, ResponsiveContainer } from 'recharts';
import { SensitivityResult } from '@shared/types/fair';
import { formatCurrency } from '../../utils/formatting';

interface Props {
  sensitivity: SensitivityResult[];
  baseALE: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const { parameterName, lowerALE, upperALE, baseALE } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs space-y-1">
      <p className="font-medium">{parameterName}</p>
      <p className="text-blue-600">-20% scenario: {formatCurrency(lowerALE)}</p>
      <p className="text-gray-500">Base: {formatCurrency(baseALE)}</p>
      <p className="text-orange-600">+20% scenario: {formatCurrency(upperALE)}</p>
    </div>
  );
};

export function TornadoChart({ sensitivity, baseALE }: Props) {
  const chartData = sensitivity.map(s => ({
    ...s,
    lower: s.lowerALE - baseALE,  // negative = left bar
    upper: s.upperALE - baseALE,  // positive = right bar
  }));

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 20, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={v => formatCurrency(v, true)} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="parameterName" tick={{ fontSize: 11 }} width={110} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={1} />
          <Bar dataKey="lower" name="-20%" stackId="a" fill="#3b82f6" fillOpacity={0.75} radius={[2, 0, 0, 2]} />
          <Bar dataKey="upper" name="+20%" stackId="b" fill="#f97316" fillOpacity={0.75} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
