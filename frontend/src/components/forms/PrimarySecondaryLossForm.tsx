import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LossComponent, SlefDistribution, PrimaryLossForm, SecondaryLossForm, DistributionType } from '@shared/types/fair';
import { FAIRComponentInput } from './FAIRComponentInput';

// ─── Loss form metadata ───────────────────────────────────────

const PRIMARY_FORMS: { value: PrimaryLossForm; label: string; description: string }[] = [
  { value: 'productivity',  label: 'Productivity',  description: 'Lost revenue or idle wages due to operational disruption' },
  { value: 'response',      label: 'Response',      description: 'Incident response, forensics, legal defense, and PR costs' },
  { value: 'replacement',   label: 'Replacement',   description: 'Hardware, software, and data reconstruction costs' },
  { value: 'other',         label: 'Other',         description: 'Any other direct costs not covered above' },
];

const SECONDARY_FORMS: { value: SecondaryLossForm; label: string; description: string }[] = [
  { value: 'fines_judgements',    label: 'Fines & Judgements',    description: 'Regulatory fines, civil judgements, and government-imposed penalties' },
  { value: 'reputation',          label: 'Reputational Damage',   description: 'Customer churn, market cap loss, and brand damage from stakeholder reactions' },
  { value: 'competitive_advantage', label: 'Competitive Advantage', description: 'IP theft, trade secret exposure, and market position loss' },
  { value: 'other',               label: 'Other',                 description: 'Any other secondary costs imposed by external parties' },
];

// ─── Helpers ──────────────────────────────────────────────────

function defaultUSDParams() {
  return { min: 50000, mode: 200000, max: 1000000 };
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function modeOf(p: any): number {
  return p?.mode ?? p?.value ?? p?.median ?? 0;
}

// ─── Single loss component card ───────────────────────────────

interface ComponentCardProps {
  component: LossComponent;
  formOptions: { value: string; label: string; description: string }[];
  onUpdate: (patch: Partial<LossComponent>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function LossComponentCard({ component, formOptions, onUpdate, onRemove, canRemove }: ComponentCardProps) {
  const desc = formOptions.find(o => o.value === component.form)?.description ?? '';

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Loss Form</label>
          <select
            className="input text-sm"
            value={component.form}
            onChange={e => onUpdate({ form: e.target.value as any })}
          >
            {formOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {component.form === 'other' && (
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Custom Label</label>
            <input
              className="input text-sm"
              placeholder="e.g., Crisis communications"
              value={component.customLabel ?? ''}
              onChange={e => onUpdate({ customLabel: e.target.value })}
            />
          </div>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 mt-4">
            Remove
          </button>
        )}
      </div>

      <FAIRComponentInput
        label=""
        unit="USD"
        guidance={desc}
        distributionType={component.distributionType as DistributionType}
        parameters={component.parameters}
        allowLognormal={true}
        onChange={(d, p) => onUpdate({ distributionType: d, parameters: p })}
        notes={component.notes}
        onNotesChange={notes => onUpdate({ notes })}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

interface Props {
  primaryComponents: LossComponent[];
  slef: SlefDistribution | undefined;
  secondaryLossEnabled: boolean;
  secondaryComponents: LossComponent[];
  onChange: (patch: {
    primaryLossComponents?: LossComponent[];
    slef?: SlefDistribution;
    secondaryLossEnabled?: boolean;
    secondaryLossComponents?: LossComponent[];
  }) => void;
}

export function PrimarySecondaryLossForm({
  primaryComponents,
  slef,
  secondaryLossEnabled,
  secondaryComponents,
  onChange,
}: Props) {

  // ── Primary helpers ──────────────────────────────────────────
  const addPrimary = () => {
    const used = new Set(primaryComponents.map(c => c.form));
    const next = PRIMARY_FORMS.find(f => !used.has(f.value))?.value ?? 'other';
    onChange({
      primaryLossComponents: [
        ...primaryComponents,
        { id: uuidv4(), form: next, distributionType: 'triangular', parameters: defaultUSDParams() },
      ],
    });
  };

  const updatePrimary = (id: string, patch: Partial<LossComponent>) => {
    onChange({ primaryLossComponents: primaryComponents.map(c => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const removePrimary = (id: string) => {
    onChange({ primaryLossComponents: primaryComponents.filter(c => c.id !== id) });
  };

  // ── Secondary helpers ────────────────────────────────────────
  const toggleSecondary = (enabled: boolean) => {
    const newState: any = { secondaryLossEnabled: enabled };
    if (enabled && secondaryComponents.length === 0) {
      newState.secondaryLossComponents = [
        { id: uuidv4(), form: 'fines_judgements', distributionType: 'triangular', parameters: defaultUSDParams() },
      ];
    }
    if (enabled && !slef) {
      newState.slef = { distributionType: 'triangular', parameters: { min: 0.1, mode: 0.3, max: 0.6 } };
    }
    onChange(newState);
  };

  const addSecondary = () => {
    const used = new Set(secondaryComponents.map(c => c.form));
    const next = SECONDARY_FORMS.find(f => !used.has(f.value))?.value ?? 'other';
    onChange({
      secondaryLossComponents: [
        ...secondaryComponents,
        { id: uuidv4(), form: next, distributionType: 'triangular', parameters: defaultUSDParams() },
      ],
    });
  };

  const updateSecondary = (id: string, patch: Partial<LossComponent>) => {
    onChange({ secondaryLossComponents: secondaryComponents.map(c => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const removeSecondary = (id: string) => {
    onChange({ secondaryLossComponents: secondaryComponents.filter(c => c.id !== id) });
  };

  // ── Totals ───────────────────────────────────────────────────
  const primaryTotal = primaryComponents.reduce((s, c) => s + modeOf(c.parameters), 0);
  const secondaryTotal = secondaryComponents.reduce((s, c) => s + modeOf(c.parameters), 0);
  const slefMode = slef ? modeOf((slef as any).parameters) : 0;
  const expectedSecondary = secondaryTotal * slefMode;
  const totalLM = primaryTotal + expectedSecondary;

  return (
    <div className="space-y-5">

      {/* ── Primary Loss ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Primary Loss Components</h4>
            <p className="text-xs text-gray-500">Direct costs caused by the loss event (Productivity, Response, Replacement)</p>
          </div>
          {primaryTotal > 0 && (
            <span className="text-xs font-medium text-gray-600">
              Mode total: <span className="text-gray-800">{formatUSD(primaryTotal)}</span>
            </span>
          )}
        </div>

        <div className="space-y-3">
          {primaryComponents.map(c => (
            <LossComponentCard
              key={c.id}
              component={c}
              formOptions={PRIMARY_FORMS}
              onUpdate={patch => updatePrimary(c.id, patch)}
              onRemove={() => removePrimary(c.id)}
              canRemove={primaryComponents.length > 1}
            />
          ))}
        </div>

        <button type="button" onClick={addPrimary} className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
          + Add primary loss component
        </button>
      </div>

      {/* ── Secondary Loss Toggle ──────────────────────────────── */}
      <div className="border-t border-gray-100 pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 text-brand-600 rounded"
            checked={secondaryLossEnabled}
            onChange={e => toggleSecondary(e.target.checked)}
          />
          <div>
            <span className="text-sm font-semibold text-gray-800">Include Secondary Loss</span>
            <p className="text-xs text-gray-500">
              Costs imposed by external stakeholders (regulators, customers, media) reacting to the primary incident
            </p>
          </div>
        </label>
      </div>

      {secondaryLossEnabled && (
        <div className="space-y-4 pl-3 border-l-2 border-orange-200">

          {/* SLEF */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-1">
              Secondary Loss Event Frequency (SLEF)
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Conditional probability (0–1) that the primary loss event triggers a secondary stakeholder reaction.
              Example: a contained breach with no customer data exposed → SLEF 0.05–0.15.
              A large PII breach with regulatory implications → SLEF 0.5–0.9.
            </p>
            <FAIRComponentInput
              label=""
              unit="probability (0–1)"
              guidance="How likely is it that external parties (regulators, media, customers) react negatively to this incident?"
              distributionType={(slef?.distributionType ?? 'triangular') as DistributionType}
              parameters={slef?.parameters ?? { min: 0.1, mode: 0.3, max: 0.6 }}
              clamp01={true}
              onChange={(d, p) => onChange({ slef: { distributionType: d, parameters: p } })}
            />
          </div>

          {/* Secondary components */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Secondary Loss Components</h4>
                <p className="text-xs text-gray-500">Magnitude if secondary loss occurs (Fines, Reputation, Competitive Advantage)</p>
              </div>
              {secondaryTotal > 0 && (
                <span className="text-xs font-medium text-gray-600">
                  Mode total: <span className="text-gray-800">{formatUSD(secondaryTotal)}</span>
                </span>
              )}
            </div>

            <div className="space-y-3">
              {secondaryComponents.map(c => (
                <LossComponentCard
                  key={c.id}
                  component={c}
                  formOptions={SECONDARY_FORMS}
                  onUpdate={patch => updateSecondary(c.id, patch)}
                  onRemove={() => removeSecondary(c.id)}
                  canRemove={secondaryComponents.length > 1}
                />
              ))}
            </div>

            <button type="button" onClick={addSecondary} className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
              + Add secondary loss component
            </button>
          </div>
        </div>
      )}

      {/* ── Summary ──────────────────────────────────────────────── */}
      {primaryComponents.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
          <div className="font-medium text-gray-700">Loss Magnitude Summary (at mode estimates)</div>
          <div>Primary Loss: <span className="font-medium">{formatUSD(primaryTotal)}</span></div>
          {secondaryLossEnabled && (
            <>
              <div>
                Expected Secondary Loss (SLEF {Math.round(slefMode * 100)}% × {formatUSD(secondaryTotal)}):{' '}
                <span className="font-medium">{formatUSD(expectedSecondary)}</span>
              </div>
              <div className="border-t border-gray-200 pt-1 font-semibold text-gray-800">
                Total Loss Magnitude: {formatUSD(totalLM)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
