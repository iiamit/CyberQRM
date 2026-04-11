import { SimulationResults as SimResult, SensitivityResult } from '@shared/types/fair';
import { ALEHistogram } from './charts/ALEHistogram';
import { TornadoChart } from './charts/TornadoChart';
import { formatCurrency, formatNumber } from '../utils/formatting';

interface Props {
  simulation: SimResult;
  sensitivity?: SensitivityResult[];
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

export function SimulationResultsView({ simulation, sensitivity }: Props) {
  const { statistics: s } = simulation;
  if (!s) return <p className="text-gray-500">No statistics available.</p>;

  return (
    <div className="space-y-6">
      {/* Key metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Mean ALE', value: formatCurrency(s.mean), color: 'text-red-600' },
          { label: 'Median (P50)', value: formatCurrency(s.median), color: 'text-blue-600' },
          { label: '90th Percentile', value: formatCurrency(s.percentiles?.['90']), color: 'text-orange-600' },
          { label: '95th Percentile', value: formatCurrency(s.percentiles?.['95']), color: 'text-purple-600' },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 rounded-lg p-3 text-center">
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Confidence intervals */}
      {s.confidenceIntervals && (
        <div className="bg-brand-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-brand-800 mb-2">Confidence Intervals</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-brand-600 font-medium">90% CI: </span>
              <span className="text-brand-900">
                {formatCurrency(s.confidenceIntervals['90']?.lower)} – {formatCurrency(s.confidenceIntervals['90']?.upper)}
              </span>
            </div>
            <div>
              <span className="text-brand-600 font-medium">95% CI: </span>
              <span className="text-brand-900">
                {formatCurrency(s.confidenceIntervals['95']?.lower)} – {formatCurrency(s.confidenceIntervals['95']?.upper)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Histogram */}
      {simulation.rawSamples?.length > 0 && (
        <div>
          <h4 className="section-title text-base">ALE Distribution ({formatNumber(simulation.rawSamples.length)} simulations)</h4>
          <ALEHistogram
            samples={simulation.rawSamples}
            mean={s.mean}
            median={s.median}
            p90={s.percentiles?.['90'] ?? 0}
            p95={s.percentiles?.['95'] ?? 0}
          />
          <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
            <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-red-500 border-dashed border-t-2 border-red-500" /> Mean</span>
            <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-blue-500 border-dashed border-t-2 border-blue-500" /> Median (P50)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-orange-500 border-dashed border-t-2 border-orange-500" /> P90</span>
          </div>
        </div>
      )}

      {/* Full percentile table */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="section-title text-base">Percentile Breakdown</h4>
          <div>
            {s.percentiles && Object.entries(s.percentiles).map(([p, v]) => (
              <StatRow key={p} label={`P${p}`} value={formatCurrency(v as number)} />
            ))}
          </div>
        </div>
        <div>
          <h4 className="section-title text-base">Distribution Statistics</h4>
          <div>
            <StatRow label="Mean" value={formatCurrency(s.mean)} />
            <StatRow label="Median" value={formatCurrency(s.median)} />
            <StatRow label="Std Deviation" value={formatCurrency(s.stdDev)} />
            <StatRow label="Minimum" value={formatCurrency(s.min)} />
            <StatRow label="Maximum" value={formatCurrency(s.max)} />
          </div>
          {simulation.convergenceMetrics && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs">
              <p className="font-medium text-gray-700">Convergence</p>
              <p className="text-gray-500">Mean stabilised: {simulation.convergenceMetrics.meanStabilized ? '✓ Yes' : '✗ No – consider more iterations'}</p>
              <p className="text-gray-500">Iterations: {formatNumber(simulation.convergenceMetrics.iterationsNeeded)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sensitivity / Tornado */}
      {sensitivity && sensitivity.length > 0 && (
        <div>
          <h4 className="section-title text-base">Sensitivity Analysis (±20% per parameter)</h4>
          <p className="text-xs text-gray-500 mb-3">
            Shows how ALE changes when each input parameter is shifted ±20%. Longer bars = higher leverage on risk.
          </p>
          <TornadoChart sensitivity={sensitivity} baseALE={s.mean} />
        </div>
      )}
    </div>
  );
}
