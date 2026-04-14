import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ValuationEntry, ValuationBasis, DistributionType } from '@shared/types/fair';
import { FAIRComponentInput } from './FAIRComponentInput';

const BASIS_OPTIONS: { value: ValuationBasis; label: string; description: string }[] = [
  { value: 'replacement_cost',     label: 'Replacement Cost',      description: 'Hardware, software, and data reconstruction costs' },
  { value: 'revenue_impact',       label: 'Revenue Impact',        description: 'Lost revenue or business opportunities during/after incident' },
  { value: 'regulatory_exposure',  label: 'Regulatory Exposure',   description: 'Potential fines, penalties, and compliance costs' },
  { value: 'business_interruption',label: 'Business Interruption', description: 'Operational downtime and productivity losses' },
  { value: 'reputational',         label: 'Reputational Value',    description: 'Brand damage, customer churn, and market position loss' },
  { value: 'custom',               label: 'Custom',                description: 'Enter a custom valuation basis' },
];

function basisLabel(basis: ValuationBasis, customLabel?: string): string {
  if (basis === 'custom') return customLabel || 'Custom';
  return BASIS_OPTIONS.find(o => o.value === basis)?.label ?? basis;
}

function defaultParams() {
  return { min: 100000, mode: 500000, max: 2000000 };
}

interface Props {
  entries: ValuationEntry[];
  onChange: (entries: ValuationEntry[]) => void;
}

export function ValuationBasisList({ entries, onChange }: Props) {
  const addEntry = () => {
    const usedBases = new Set(entries.map(e => e.basis));
    const nextBasis = BASIS_OPTIONS.find(o => !usedBases.has(o.value))?.value ?? 'custom';
    onChange([
      ...entries,
      {
        id: uuidv4(),
        basis: nextBasis,
        distributionType: 'triangular',
        parameters: defaultParams(),
      },
    ]);
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, patch: Partial<ValuationEntry>) => {
    onChange(entries.map(e => (e.id === id ? { ...e, ...patch } : e)));
  };

  const combinedMode = entries.reduce((sum, e) => {
    const p = e.parameters as any;
    return sum + (p.mode ?? p.value ?? p.median ?? 0);
  }, 0);

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n.toFixed(0)}`;

  return (
    <div className="space-y-4">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Basis {idx + 1}: {basisLabel(entry.basis, entry.customBasisLabel)}
            </span>
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valuation Basis</label>
              <select
                className="input text-sm"
                value={entry.basis}
                onChange={e =>
                  updateEntry(entry.id, { basis: e.target.value as ValuationBasis })
                }
              >
                {BASIS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {entry.basis === 'custom' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Custom Label</label>
                <input
                  className="input text-sm"
                  placeholder="e.g., IP / Trade secrets"
                  value={entry.customBasisLabel ?? ''}
                  onChange={e => updateEntry(entry.id, { customBasisLabel: e.target.value })}
                />
              </div>
            )}
          </div>

          <FAIRComponentInput
            label=""
            unit="USD"
            guidance={BASIS_OPTIONS.find(o => o.value === entry.basis)?.description ?? ''}
            distributionType={entry.distributionType as DistributionType}
            parameters={entry.parameters}
            allowLognormal={true}
            onChange={(d, p) => updateEntry(entry.id, { distributionType: d, parameters: p })}
            notes={entry.notes}
            onNotesChange={notes => updateEntry(entry.id, { notes })}
          />
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addEntry}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          + Add valuation basis
        </button>
        {entries.length > 0 && (
          <div className="text-sm text-gray-600">
            Combined AV (sum of modes):{' '}
            <span className="font-semibold text-gray-800">{fmt(combinedMode)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
