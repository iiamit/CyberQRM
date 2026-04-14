import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { controlsApi, scenariosApi } from '../utils/api';
import { formatCurrency, formatPct, formatPercent } from '../utils/formatting';
import { Header } from '../components/layout/Header';
import { Modal } from '../components/ui/Modal';
import { ControlForm } from '../components/forms/ControlForm';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../store/appStore';
import { Control } from '@shared/types/fair';

const CATEGORY_COLORS: Record<string, string> = {
  preventive:   'badge-blue',
  detective:    'badge-yellow',
  corrective:   'badge-orange',
  compensating: 'badge-gray',
};

export function Controls() {
  const qc = useQueryClient();
  const { showNotification } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState<Control | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Control | null>(null);
  const [impactState, setImpactState] = useState<{ controlId: string; loading: boolean; error?: string } | null>(null);

  const { data: controls = [], isLoading } = useQuery({ queryKey: ['controls'], queryFn: controlsApi.list });
  const { data: scenarios = [] } = useQuery({ queryKey: ['scenarios'], queryFn: scenariosApi.list });

  const simulatedScenarios = scenarios.filter(s => s.latestSimulation?.statistics?.mean);

  const createMutation = useMutation({
    mutationFn: controlsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['controls'] }); setShowNew(false); showNotification('success', 'Control created'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Control> }) => controlsApi.update(id, data),
    onSuccess: (updatedControl) => {
      qc.invalidateQueries({ queryKey: ['controls'] });
      setEditTarget(null);
      showNotification('success', 'Control updated');
      // Auto-recalculate impact for selected scenario if one was chosen
      if (selectedScenario) {
        setImpactState({ controlId: updatedControl.id, loading: true });
        controlsApi.calculateImpact(updatedControl.id, selectedScenario)
          .then(() => {
            qc.invalidateQueries({ queryKey: ['controls'] });
            showNotification('success', 'Impact recalculated');
            setImpactState(null);
          })
          .catch(() => {
            setImpactState({ controlId: updatedControl.id, loading: false, error: 'Recalc failed' });
            showNotification('error', 'Failed to recalculate impact');
          });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => controlsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['controls'] }); setDeleteTarget(null); showNotification('success', 'Control deleted'); },
  });

  const [selectedScenario, setSelectedScenario] = useState('');

  const handleCalculateImpact = async (controlId: string) => {
    if (!selectedScenario) { showNotification('error', 'Select a scenario first'); return; }
    setImpactState({ controlId, loading: true });
    try {
      await controlsApi.calculateImpact(controlId, selectedScenario);
      qc.invalidateQueries({ queryKey: ['controls'] });
      showNotification('success', 'Impact projection calculated');
      setImpactState(null);
    } catch (err: any) {
      setImpactState({ controlId, loading: false, error: err?.response?.data?.error ?? 'Error' });
      showNotification('error', err?.response?.data?.error ?? 'Failed to calculate impact');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Controls & Mitigations"
        actions={<button className="btn-primary" onClick={() => setShowNew(true)}>+ New Control</button>}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Scenario picker for impact calc */}
        {simulatedScenarios.length > 0 && (
          <div className="card mb-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Calculate impact for:</label>
            <select
              className="input max-w-sm"
              value={selectedScenario}
              onChange={e => setSelectedScenario(e.target.value)}
            >
              <option value="">Select a scenario...</option>
              {simulatedScenarios.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.latestSimulation!.statistics.mean, true)})</option>
              ))}
            </select>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
        ) : controls.length === 0 ? (
          <EmptyState
            title="No controls defined"
            description="Define controls to model how implementing safeguards reduces your risk exposure and calculate ROI."
            action={<button className="btn-primary" onClick={() => setShowNew(true)}>Create First Control</button>}
          />
        ) : (
          <div className="space-y-4">
            {controls.map(c => {
              const projection = selectedScenario
                ? c.impactProjections.find(p => p.scenarioId === selectedScenario)
                : c.impactProjections[0];

              return (
                <div key={c.id} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{c.name}</h3>
                        <span className={`badge ${CATEGORY_COLORS[c.category] ?? 'badge-gray'}`}>{c.category}</span>
                        <span className="badge badge-gray text-xs">→ {c.targetComponent}</span>
                      </div>
                      {c.description && <p className="text-sm text-gray-500 mb-3">{c.description}</p>}

                      {/* Current vs Proposed */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-gray-500">Current Effectiveness</p>
                          <p className="font-semibold text-gray-800">{formatPercent(c.currentState.effectiveness)}</p>
                        </div>
                        <div className="bg-brand-50 rounded p-2">
                          <p className="text-brand-600">Proposed Effectiveness</p>
                          <p className="font-semibold text-brand-800">{formatPercent(c.proposedState.effectiveness)}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-gray-500">Impl. Cost</p>
                          <p className="font-semibold text-gray-800">{formatCurrency(c.proposedState.estimatedImplementationCost, true)}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-gray-500">Annual Cost</p>
                          <p className="font-semibold text-gray-800">{formatCurrency(c.proposedState.estimatedAnnualCost, true)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <button onClick={() => setEditTarget(c)} className="btn-secondary text-xs py-1 px-2">Edit</button>
                      <button onClick={() => setDeleteTarget(c)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Impact projection */}
                  {projection ? (
                    <div className="mt-4 bg-green-50 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-green-700 mb-2">Impact Projection</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><p className="text-gray-500">Current ALE</p><p className="font-bold text-gray-800">{formatCurrency(projection.currentALE, true)}</p></div>
                        <div><p className="text-gray-500">Projected ALE</p><p className="font-bold text-green-700">{formatCurrency(projection.projectedALE, true)}</p></div>
                        <div><p className="text-gray-500">ALE Reduction</p><p className="font-bold text-green-700">{formatCurrency(projection.aleReduction, true)} ({formatPct(projection.aleReductionPercent)})</p></div>
                        <div><p className="text-gray-500">3-Year ROI</p><p className="font-bold text-green-700">{formatPct(projection.roi)}</p></div>
                      </div>
                      {projection.paybackPeriodMonths < 999 && (
                        <p className="text-xs text-green-600 mt-1">Payback period: {projection.paybackPeriodMonths} months</p>
                      )}
                    </div>
                  ) : selectedScenario && (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => handleCalculateImpact(c.id)}
                        disabled={impactState?.controlId === c.id && impactState.loading}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        {impactState?.controlId === c.id && impactState.loading ? <Spinner size="sm" /> : 'Calculate Impact'}
                      </button>
                      <span className="text-xs text-gray-400">for selected scenario</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Control" size="md">
        <ControlForm
          onSubmit={createMutation.mutateAsync}
          onCancel={() => setShowNew(false)}
          isLoading={createMutation.isPending}
        />
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Control" size="md">
        {editTarget && (
          <ControlForm
            initialData={editTarget}
            onSubmit={data => updateMutation.mutateAsync({ id: editTarget.id, data })}
            onCancel={() => setEditTarget(null)}
            isLoading={updateMutation.isPending}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Control"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
