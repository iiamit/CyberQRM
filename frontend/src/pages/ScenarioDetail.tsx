import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scenariosApi } from '../utils/api';
import { formatCurrency, statusBadgeClass } from '../utils/formatting';
import { generateExecutiveReport, generateTechnicalReport, printReport } from '../utils/reportGenerator';
import { Header } from '../components/layout/Header';
import { Modal } from '../components/ui/Modal';
import { ScenarioForm } from '../components/forms/ScenarioForm';
import { SimulationResultsView } from '../components/SimulationResults';
import { Spinner } from '../components/ui/Spinner';
import { useAppStore } from '../store/appStore';

type Tab = 'overview' | 'components' | 'simulation' | 'sensitivity';

export function ScenarioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showNotification } = useAppStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [simResults, setSimResults] = useState<any>(null);

  const { data: scenario, isLoading } = useQuery({
    queryKey: ['scenario', id],
    queryFn: () => scenariosApi.get(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => scenariosApi.update(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenario', id] }); setShowEdit(false); showNotification('success', 'Scenario updated'); },
  });

  const simulateMutation = useMutation({
    mutationFn: () => scenariosApi.simulate(id!),
    onSuccess: (data) => {
      setSimResults(data);
      qc.invalidateQueries({ queryKey: ['scenario', id] });
      setTab('simulation');
      showNotification('success', 'Simulation complete');
    },
    onError: (err: any) => showNotification('error', err?.response?.data?.error ?? 'Simulation failed'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  );
  if (!scenario) return <div className="p-6 text-gray-500">Scenario not found. <Link to="/scenarios" className="text-brand-600">Back →</Link></div>;

  const sim = simResults?.simulation ?? scenario.latestSimulation;
  const sensitivity = simResults?.sensitivity;

  const isComplete = scenario.threatEventFrequency && scenario.vulnerability && scenario.assetValue && scenario.lossEventImpact;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',   label: 'Overview' },
    { key: 'components', label: 'FAIR Components' },
    { key: 'simulation', label: 'Simulation Results' },
    { key: 'sensitivity', label: 'Sensitivity' },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title={scenario.name}
        actions={
          <div className="flex gap-2">
            <Link to="/scenarios" className="btn-secondary text-sm py-1.5 px-3">← Back</Link>
            <button onClick={() => setShowEdit(true)} className="btn-secondary text-sm py-1.5 px-3">Edit</button>
            {sim && <>
              <button className="btn-secondary text-sm py-1.5 px-3" onClick={() => printReport(generateExecutiveReport([scenario], undefined, sensitivity ? [sensitivity] : undefined), `${scenario.name}-executive.html`)}>Executive Report</button>
              <button className="btn-secondary text-sm py-1.5 px-3" onClick={() => printReport(generateTechnicalReport([scenario], undefined, sensitivity ? [sensitivity] : undefined), `${scenario.name}-technical.html`)}>Tech Report</button>
            </>}
            <button
              onClick={() => simulateMutation.mutate()}
              disabled={!isComplete || simulateMutation.isPending}
              className="btn-primary text-sm py-1.5 px-3"
            >
              {simulateMutation.isPending ? <><Spinner size="sm" /> Running...</> : 'Run Simulation'}
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {/* Status bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <span className={`badge ${statusBadgeClass(scenario.status)}`}>{scenario.status}</span>
          {!isComplete && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
              Define all 4 FAIR components to enable simulation
            </span>
          )}
          {sim?.statistics?.mean != null && (
            <span className="text-sm">
              <span className="text-gray-500">Mean ALE: </span>
              <span className="font-bold text-red-600">{formatCurrency(sim.statistics.mean)}</span>
              {sim.statistics.confidenceIntervals?.['90'] && (
                <span className="text-gray-400 text-xs ml-2">
                  90% CI: {formatCurrency(sim.statistics.confidenceIntervals['90'].lower, true)} – {formatCurrency(sim.statistics.confidenceIntervals['90'].upper, true)}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
              <div className="card">
                <h3 className="section-title">Scenario Details</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-gray-500">Asset Description</dt>
                    <dd className="text-sm text-gray-800 mt-0.5">{scenario.assetDescription || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Business Context</dt>
                    <dd className="text-sm text-gray-800 mt-0.5">{scenario.businessContext || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Description</dt>
                    <dd className="text-sm text-gray-800 mt-0.5">{scenario.description || '—'}</dd>
                  </div>
                </dl>
              </div>
              <div className="card">
                <h3 className="section-title">FAIR Components Status</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Threat Event Frequency (TEF)', defined: !!scenario.threatEventFrequency },
                    { label: 'Vulnerability (V)', defined: !!scenario.vulnerability },
                    { label: 'Asset Value (AV)', defined: !!scenario.assetValue },
                    { label: 'Loss Event Impact (LI)', defined: !!scenario.lossEventImpact },
                  ].map(c => (
                    <div key={c.label} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${c.defined ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {c.defined ? '✓' : '○'}
                      </span>
                      <span className={`text-sm ${c.defined ? 'text-gray-700' : 'text-gray-400'}`}>{c.label}</span>
                    </div>
                  ))}
                </div>
                {!isComplete && (
                  <button onClick={() => setShowEdit(true)} className="btn-primary mt-4 w-full text-sm">
                    Define Components
                  </button>
                )}
              </div>
              {sim && (
                <div className="card lg:col-span-2">
                  <h3 className="section-title">Quick Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Mean ALE', value: formatCurrency(sim.statistics.mean) },
                      { label: 'P50 (Median)', value: formatCurrency(sim.statistics.median) },
                      { label: 'P90', value: formatCurrency(sim.statistics.percentiles?.['90']) },
                    ].map(m => (
                      <div key={m.label} className="text-center">
                        <p className="text-xl font-bold text-gray-900">{m.value}</p>
                        <p className="text-xs text-gray-500">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'components' && (
            <div className="max-w-3xl space-y-4">
              {[
                { label: 'Threat Event Frequency (TEF)', data: scenario.threatEventFrequency, unit: 'events/year' },
                { label: 'Vulnerability (V)', data: scenario.vulnerability, unit: 'probability' },
                { label: 'Asset Value (AV)', data: scenario.assetValue, unit: 'USD' },
                { label: 'Loss Event Impact (LI)', data: scenario.lossEventImpact, unit: '0–1' },
              ].map(c => (
                <div key={c.label} className="card">
                  <h3 className="font-semibold text-gray-800 mb-2">{c.label}</h3>
                  {c.data ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Distribution: </span>
                        <span className="font-medium capitalize">{c.data.distributionType}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Unit: </span>
                        <span className="font-medium">{c.unit}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Parameters: </span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {JSON.stringify(c.data.parameters)}
                        </code>
                      </div>
                      {(c.data as any).description && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Description: </span>
                          <span>{(c.data as any).description}</span>
                        </div>
                      )}
                      {c.data.notes && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Notes: </span>
                          <span className="text-gray-700">{c.data.notes}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">Not defined yet. <button onClick={() => setShowEdit(true)} className="text-brand-600 hover:underline">Define now →</button></p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'simulation' && (
            <div className="max-w-4xl">
              {sim ? (
                <SimulationResultsView simulation={sim} sensitivity={sensitivity} />
              ) : (
                <div className="card text-center py-12">
                  <p className="text-gray-500 mb-4">No simulation results yet.</p>
                  {isComplete ? (
                    <button onClick={() => simulateMutation.mutate()} disabled={simulateMutation.isPending} className="btn-primary">
                      {simulateMutation.isPending ? 'Running...' : 'Run Monte Carlo Simulation'}
                    </button>
                  ) : (
                    <p className="text-yellow-600 text-sm">Define all 4 FAIR components first.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'sensitivity' && (
            <div className="max-w-3xl">
              {sensitivity ? (
                <SimulationResultsView simulation={sim} sensitivity={sensitivity} />
              ) : (
                <div className="card text-center py-12">
                  <p className="text-gray-500">Run a simulation to see sensitivity analysis.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Scenario" size="xl">
        <ScenarioForm
          initialData={scenario}
          onSubmit={updateMutation.mutateAsync}
          onCancel={() => setShowEdit(false)}
          isLoading={updateMutation.isPending}
        />
      </Modal>
    </div>
  );
}
