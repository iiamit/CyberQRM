import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { RiskScenario, DistributionType } from '@shared/types/fair';
import { FAIRComponentInput } from './FAIRComponentInput';

interface ScenarioFormProps {
  initialData?: Partial<RiskScenario>;
  onSubmit: (data: Partial<RiskScenario>) => Promise<any>;
  onCancel: () => void;
  isLoading?: boolean;
}

const STEPS = ['Basic Info', 'Threat Frequency', 'Vulnerability', 'Asset Value', 'Loss Impact', 'Review'];

export function ScenarioForm({ initialData, onSubmit, onCancel, isLoading }: ScenarioFormProps) {
  const [step, setStep] = useState(0);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      assetDescription: initialData?.assetDescription ?? '',
      businessContext: initialData?.businessContext ?? '',
      iterations: initialData?.simulationConfig?.iterations ?? 10000,
    },
  });

  // TEF state
  const [tefDist, setTefDist] = useState<DistributionType>(initialData?.threatEventFrequency?.distributionType ?? 'triangular');
  const [tefParams, setTefParams] = useState(initialData?.threatEventFrequency?.parameters ?? { min: 0.5, mode: 2, max: 10 });
  const [tefNotes, setTefNotes] = useState(initialData?.threatEventFrequency?.notes ?? '');
  const [tefDesc, setTefDesc] = useState(initialData?.threatEventFrequency?.description ?? '');

  // Vulnerability state
  const [vulnDist, setVulnDist] = useState<DistributionType>(initialData?.vulnerability?.distributionType ?? 'triangular');
  const [vulnParams, setVulnParams] = useState(initialData?.vulnerability?.parameters ?? { min: 0.1, mode: 0.3, max: 0.7 });
  const [vulnNotes, setVulnNotes] = useState(initialData?.vulnerability?.notes ?? '');
  const [vulnDesc, setVulnDesc] = useState(initialData?.vulnerability?.description ?? '');

  // Asset Value state
  const [avDist, setAvDist] = useState<DistributionType>(initialData?.assetValue?.distributionType ?? 'triangular');
  const [avParams, setAvParams] = useState(initialData?.assetValue?.parameters ?? { min: 500000, mode: 2000000, max: 10000000 });
  const [avNotes, setAvNotes] = useState(initialData?.assetValue?.notes ?? '');
  const [avDesc, setAvDesc] = useState(initialData?.assetValue?.description ?? '');
  const [avBasis, setAvBasis] = useState(initialData?.assetValue?.valuationBasis ?? '');

  // Loss Event Impact state
  const [leiDist, setLeiDist] = useState<DistributionType>(initialData?.lossEventImpact?.distributionType ?? 'triangular');
  const [leiParams, setLeiParams] = useState(initialData?.lossEventImpact?.parameters ?? { min: 0.05, mode: 0.2, max: 0.6 });
  const [leiNotes, setLeiNotes] = useState(initialData?.lossEventImpact?.notes ?? '');
  const [leiDesc, setLeiDesc] = useState(initialData?.lossEventImpact?.description ?? '');

  const handleFinalSubmit = handleSubmit(async (formData) => {
    const payload: Partial<RiskScenario> = {
      name: formData.name,
      description: formData.description,
      assetDescription: formData.assetDescription,
      businessContext: formData.businessContext,
      simulationConfig: { iterations: formData.iterations, confidenceIntervals: [90, 95] },
      threatEventFrequency: {
        id: initialData?.threatEventFrequency?.id ?? '',
        scenarioId: initialData?.id ?? '',
        name: 'Threat Event Frequency',
        description: tefDesc,
        distributionType: tefDist,
        parameters: tefParams as any,
        unitLabel: 'events/year',
        notes: tefNotes,
      },
      vulnerability: {
        id: initialData?.vulnerability?.id ?? '',
        scenarioId: initialData?.id ?? '',
        name: 'Vulnerability',
        description: vulnDesc,
        distributionType: vulnDist,
        parameters: vulnParams as any,
        unitLabel: '0–1 (probability)',
        relatedControls: [],
        notes: vulnNotes,
      },
      assetValue: {
        id: initialData?.assetValue?.id ?? '',
        scenarioId: initialData?.id ?? '',
        name: 'Asset Value',
        description: avDesc,
        distributionType: avDist,
        parameters: avParams as any,
        unitLabel: 'USD',
        valuationBasis: avBasis,
        notes: avNotes,
      },
      lossEventImpact: {
        id: initialData?.lossEventImpact?.id ?? '',
        scenarioId: initialData?.id ?? '',
        name: 'Loss Event Impact',
        description: leiDesc,
        distributionType: leiDist,
        parameters: leiParams as any,
        unitLabel: '0–1 (% of asset value lost)',
        impactComponents: [],
        notes: leiNotes,
      },
    };
    await onSubmit(payload);
  });

  const steps = [
    // Step 0: Basic Info
    <div className="space-y-4" key="basic">
      <div>
        <label className="label">Scenario Name *</label>
        <input className="input" placeholder="e.g., Ransomware attack on customer database"
          {...register('name', { required: 'Name is required' })} />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input resize-none" rows={2} placeholder="Brief scenario description..."
          {...register('description')} />
      </div>
      <div>
        <label className="label">Asset Description *</label>
        <textarea className="input resize-none" rows={2} placeholder="What asset is at risk? (e.g., 'Customer PII database containing 2M records')"
          {...register('assetDescription', { required: 'Asset description is required' })} />
        {errors.assetDescription && <p className="text-red-500 text-xs mt-1">{errors.assetDescription.message}</p>}
      </div>
      <div>
        <label className="label">Business Context</label>
        <textarea className="input resize-none" rows={2} placeholder="Why does this asset matter to the business?"
          {...register('businessContext')} />
      </div>
    </div>,

    // Step 1: TEF
    <div className="space-y-4" key="tef">
      <div>
        <label className="label">Threat Description</label>
        <input className="input" placeholder="e.g., External ransomware actor targeting corporate network"
          value={tefDesc} onChange={e => setTefDesc(e.target.value)} />
      </div>
      <FAIRComponentInput
        label="Threat Event Frequency" unit="events/year"
        guidance="How often will a threat actor attempt to exploit this vulnerability per year? Typical ranges: nation-state = 10–100/yr, opportunistic = 1–10/yr, targeted = 0.1–5/yr."
        distributionType={tefDist} parameters={tefParams}
        onChange={(d, p) => { setTefDist(d); setTefParams(p); }}
        notes={tefNotes} onNotesChange={setTefNotes}
      />
    </div>,

    // Step 2: Vulnerability
    <div className="space-y-4" key="vuln">
      <div>
        <label className="label">Vulnerability Description</label>
        <input className="input" placeholder="e.g., Probability of successful phishing given email controls"
          value={vulnDesc} onChange={e => setVulnDesc(e.target.value)} />
      </div>
      <FAIRComponentInput
        label="Vulnerability" unit="probability (0–1)"
        guidance="What is the probability that the threat succeeds given an attempt? Consider your current controls. Typical ranges: no controls = 0.5–0.9, basic controls = 0.2–0.5, strong controls = 0.05–0.2."
        distributionType={vulnDist} parameters={vulnParams}
        clamp01={true}
        onChange={(d, p) => { setVulnDist(d); setVulnParams(p); }}
        notes={vulnNotes} onNotesChange={setVulnNotes}
      />
    </div>,

    // Step 3: Asset Value
    <div className="space-y-4" key="av">
      <div>
        <label className="label">Asset Description</label>
        <input className="input" placeholder="e.g., Customer PII database – replacement cost + regulatory fines"
          value={avDesc} onChange={e => setAvDesc(e.target.value)} />
      </div>
      <div>
        <label className="label">Valuation Basis</label>
        <select className="input" value={avBasis} onChange={e => setAvBasis(e.target.value)}>
          <option value="">Select valuation basis...</option>
          <option>Replacement cost</option>
          <option>Revenue impact</option>
          <option>Regulatory fine exposure</option>
          <option>Business interruption</option>
          <option>Reputational / brand damage</option>
          <option>Combined estimate</option>
        </select>
      </div>
      <FAIRComponentInput
        label="Asset Value" unit="USD"
        guidance="What is the total monetary value of the asset at risk? Include direct and indirect costs: replacement, regulatory fines, revenue loss, remediation, reputational damage."
        distributionType={avDist} parameters={avParams}
        allowLognormal={true}
        onChange={(d, p) => { setAvDist(d); setAvParams(p); }}
        notes={avNotes} onNotesChange={setAvNotes}
      />
    </div>,

    // Step 4: Loss Event Impact
    <div className="space-y-4" key="lei">
      <div>
        <label className="label">Impact Description</label>
        <input className="input" placeholder="e.g., Proportion of asset value lost per successful ransomware event"
          value={leiDesc} onChange={e => setLeiDesc(e.target.value)} />
      </div>
      <FAIRComponentInput
        label="Loss Event Impact" unit="proportion of asset value (0–1)"
        guidance="What proportion of the asset value is lost per event? 0.1 = 10% of asset value destroyed. Consider: confidentiality (data exposed), integrity (data corrupted), availability (downtime)."
        distributionType={leiDist} parameters={leiParams}
        clamp01={true}
        onChange={(d, p) => { setLeiDist(d); setLeiParams(p); }}
        notes={leiNotes} onNotesChange={setLeiNotes}
      />
    </div>,

    // Step 5: Review
    <div className="space-y-4" key="review">
      <h3 className="font-semibold text-gray-800">Review & Simulation Config</h3>
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="text-gray-500">TEF:</span> <span className="font-medium">{tefDist}</span></div>
          <div><span className="text-gray-500">Vulnerability:</span> <span className="font-medium">{vulnDist}</span></div>
          <div><span className="text-gray-500">Asset Value:</span> <span className="font-medium">{avDist}</span></div>
          <div><span className="text-gray-500">Loss Impact:</span> <span className="font-medium">{leiDist}</span></div>
        </div>
      </div>
      <div>
        <label className="label">Monte Carlo Iterations</label>
        <select className="input max-w-xs" {...register('iterations', { valueAsNumber: true })}>
          <option value={1000}>1,000 (fast preview)</option>
          <option value={5000}>5,000</option>
          <option value={10000}>10,000 (recommended)</option>
          <option value={50000}>50,000 (high precision)</option>
        </select>
      </div>
    </div>,
  ];

  return (
    <form onSubmit={handleFinalSubmit} noValidate>
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                i === step ? 'bg-brand-600 text-white' :
                i < step ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {i + 1}. {s}
            </button>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 min-w-[8px]" />}
          </React.Fragment>
        ))}
      </div>

      {/* Current step */}
      <div className="min-h-[280px]">{steps[step]}</div>

      {/* Actions */}
      <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
        <button type="button" className="btn-secondary" onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={() => setStep(s => s + 1)}>
            Next →
          </button>
        ) : (
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : initialData?.id ? 'Save Changes' : 'Create Scenario'}
          </button>
        )}
      </div>
    </form>
  );
}
