import React from 'react';
import { DistributionType, TriangularParams, LognormalParams, PointParams } from '@shared/types/fair';

interface FAIRComponentInputProps {
  label: string;
  unit: string;
  guidance: string;
  distributionType: DistributionType;
  parameters: any;
  allowLognormal?: boolean;
  clamp01?: boolean;
  onChange: (distributionType: DistributionType, parameters: any) => void;
  notes?: string;
  onNotesChange?: (notes: string) => void;
  additionalFields?: React.ReactNode;
}

const DIST_DESCRIPTIONS: Record<DistributionType, string> = {
  triangular: 'Use when you have expert estimates for min, most-likely, and max values.',
  lognormal:  'Use for positive values with a long right tail — typical for cyber/financial losses.',
  point:      'Use when you have a known or highly-confident single value.',
};

export function FAIRComponentInput({
  label, unit, guidance, distributionType, parameters,
  allowLognormal = true, clamp01 = false, onChange,
  notes, onNotesChange, additionalFields,
}: FAIRComponentInputProps) {
  const setDist = (type: DistributionType) => {
    const defaults: Record<DistributionType, any> = {
      triangular: { min: clamp01 ? 0.1 : 1, mode: clamp01 ? 0.3 : 5, max: clamp01 ? 0.7 : 10 },
      lognormal:  { median: clamp01 ? 0.2 : 3, percentile90: clamp01 ? 0.6 : 15 },
      point:      { value: clamp01 ? 0.3 : 5 },
    };
    onChange(type, defaults[type]);
  };

  const update = (key: string, raw: string) => {
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    const clamped = clamp01 ? Math.min(1, Math.max(0, val)) : Math.max(0, val);
    onChange(distributionType, { ...parameters, [key]: clamped });
  };

  return (
    <div className="space-y-4">
      {/* Distribution type selector */}
      <div>
        <label className="label">Distribution Type</label>
        <div className="flex gap-2">
          {(['triangular', 'lognormal', 'point'] as DistributionType[])
            .filter(t => t !== 'lognormal' || allowLognormal)
            .map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setDist(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  distributionType === t
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">{DIST_DESCRIPTIONS[distributionType]}</p>
      </div>

      {/* Parameters */}
      <div>
        <label className="label">Parameters <span className="text-gray-400 font-normal">({unit})</span></label>
        {distributionType === 'triangular' && (
          <div className="grid grid-cols-3 gap-3">
            {(['min', 'mode', 'max'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs text-gray-500 mb-1 capitalize">{field === 'mode' ? 'Most Likely' : field}</label>
                <input
                  type="number"
                  step={clamp01 ? '0.01' : '0.1'}
                  min={clamp01 ? '0' : '0'}
                  max={clamp01 ? '1' : undefined}
                  className="input"
                  value={parameters?.[field] ?? ''}
                  onChange={e => update(field, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
        {distributionType === 'lognormal' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Median (50th percentile)</label>
              <input type="number" step={clamp01 ? '0.01' : '0.1'} min="0" className="input"
                value={parameters?.median ?? ''} onChange={e => update('median', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">90th Percentile</label>
              <input type="number" step={clamp01 ? '0.01' : '0.1'} min="0" className="input"
                value={parameters?.percentile90 ?? ''} onChange={e => update('percentile90', e.target.value)} />
            </div>
          </div>
        )}
        {distributionType === 'point' && (
          <div className="max-w-xs">
            <label className="block text-xs text-gray-500 mb-1">Value</label>
            <input type="number" step={clamp01 ? '0.01' : '0.1'} min="0" max={clamp01 ? '1' : undefined}
              className="input" value={parameters?.value ?? ''}
              onChange={e => update('value', e.target.value)} />
          </div>
        )}

        {/* Distribution range preview */}
        {distributionType === 'triangular' && parameters?.min != null && (
          <div className="mt-2 text-xs text-gray-500">
            Range: {parameters.min} → {parameters.mode} → {parameters.max} {unit}
          </div>
        )}
      </div>

      {/* Guidance */}
      <div className="bg-blue-50 rounded-lg p-3">
        <p className="text-xs text-blue-700"><span className="font-semibold">Guidance:</span> {guidance}</p>
      </div>

      {additionalFields}

      {/* Notes */}
      {onNotesChange !== undefined && (
        <div>
          <label className="label">Assumptions & Rationale</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Document your reasoning, data sources, or assumptions here..."
            value={notes ?? ''}
            onChange={e => onNotesChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
