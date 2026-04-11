import { useForm } from 'react-hook-form';
import { Control, ControlCategory, FAIRComponentKey } from '@shared/types/fair';

interface ControlFormProps {
  initialData?: Partial<Control>;
  onSubmit: (data: Partial<Control>) => Promise<any>;
  onCancel: () => void;
  isLoading?: boolean;
}

const CATEGORIES: { value: ControlCategory; label: string }[] = [
  { value: 'preventive',   label: 'Preventive' },
  { value: 'detective',    label: 'Detective' },
  { value: 'corrective',   label: 'Corrective' },
  { value: 'compensating', label: 'Compensating' },
];

const TARGET_COMPONENTS: { value: FAIRComponentKey; label: string }[] = [
  { value: 'tef',           label: 'Threat Event Frequency (TEF)' },
  { value: 'vulnerability', label: 'Vulnerability' },
  { value: 'assetValue',    label: 'Asset Value' },
  { value: 'lei',           label: 'Loss Event Impact' },
];

export function ControlForm({ initialData, onSubmit, onCancel, isLoading }: ControlFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name:                        initialData?.name ?? '',
      description:                 initialData?.description ?? '',
      category:                    initialData?.category ?? 'preventive',
      targetComponent:             initialData?.targetComponent ?? 'vulnerability',
      currentImplemented:          initialData?.currentState?.implemented ?? false,
      currentMaturityLevel:        initialData?.currentState?.maturityLevel ?? 1,
      currentEffectiveness:        initialData?.currentState?.effectiveness ?? 0,
      proposedImplemented:         initialData?.proposedState?.implemented ?? true,
      proposedMaturityLevel:       initialData?.proposedState?.maturityLevel ?? 3,
      proposedEffectiveness:       initialData?.proposedState?.effectiveness ?? 0.5,
      implementationCost:          initialData?.proposedState?.estimatedImplementationCost ?? 0,
      annualCost:                  initialData?.proposedState?.estimatedAnnualCost ?? 0,
      timelineMonths:              initialData?.proposedState?.timelineMonths ?? 6,
    },
  });

  const handleFinalSubmit = handleSubmit(async (data) => {
    await onSubmit({
      name:            data.name,
      description:     data.description,
      category:        data.category as ControlCategory,
      targetComponent: data.targetComponent as FAIRComponentKey,
      currentState: {
        implemented:    data.currentImplemented as unknown as boolean,
        maturityLevel:  Number(data.currentMaturityLevel),
        effectiveness:  Number(data.currentEffectiveness),
      },
      proposedState: {
        implemented:                   data.proposedImplemented as unknown as boolean,
        maturityLevel:                 Number(data.proposedMaturityLevel),
        effectiveness:                 Number(data.proposedEffectiveness),
        estimatedImplementationCost:   Number(data.implementationCost),
        estimatedAnnualCost:           Number(data.annualCost),
        timelineMonths:                Number(data.timelineMonths),
      },
    });
  });

  const inputRange = (name: string, min: number, max: number, step = 1) =>
    register(name as any, { valueAsNumber: true, min, max });

  return (
    <form onSubmit={handleFinalSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Control Name *</label>
          <input className="input" placeholder="e.g., Multi-Factor Authentication"
            {...register('name', { required: 'Name required' })} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div className="col-span-2">
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2}
            placeholder="What does this control do?" {...register('description')} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" {...register('category')}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Targets FAIR Component</label>
          <select className="input" {...register('targetComponent')}>
            {TARGET_COMPONENTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Current State */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Current State</h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label text-xs">Implemented?</label>
            <select className="input" {...register('currentImplemented')}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Maturity (1–5)</label>
            <input type="number" min={1} max={5} className="input" {...register('currentMaturityLevel', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label text-xs">Effectiveness (0–1)</label>
            <input type="number" min={0} max={1} step={0.05} className="input" {...register('currentEffectiveness', { valueAsNumber: true })} />
          </div>
        </div>
      </div>

      {/* Proposed State */}
      <div className="bg-brand-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-brand-700 mb-3">Proposed State (after implementation)</h4>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="label text-xs">Implemented?</label>
            <select className="input" {...register('proposedImplemented')}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Maturity (1–5)</label>
            <input type="number" min={1} max={5} className="input" {...register('proposedMaturityLevel', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label text-xs">Effectiveness (0–1)</label>
            <input type="number" min={0} max={1} step={0.05} className="input" {...register('proposedEffectiveness', { valueAsNumber: true })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label text-xs">Impl. Cost (USD)</label>
            <input type="number" min={0} className="input" {...register('implementationCost', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label text-xs">Annual Cost (USD)</label>
            <input type="number" min={0} className="input" {...register('annualCost', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label text-xs">Timeline (months)</label>
            <input type="number" min={1} max={60} className="input" {...register('timelineMonths', { valueAsNumber: true })} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData?.id ? 'Save Changes' : 'Create Control'}
        </button>
      </div>
    </form>
  );
}
