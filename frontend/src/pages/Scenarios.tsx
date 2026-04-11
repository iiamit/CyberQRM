import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { scenariosApi } from '../utils/api';
import { formatCurrency, statusBadgeClass, aleToRiskPriority, riskBadgeClass } from '../utils/formatting';
import { Header } from '../components/layout/Header';
import { Modal } from '../components/ui/Modal';
import { ScenarioForm } from '../components/forms/ScenarioForm';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../store/appStore';
import { RiskScenario } from '@shared/types/fair';

export function Scenarios() {
  const qc = useQueryClient();
  const { showNotification } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RiskScenario | null>(null);

  const { data: scenarios = [], isLoading } = useQuery({ queryKey: ['scenarios'], queryFn: scenariosApi.list });

  const createMutation = useMutation({
    mutationFn: scenariosApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenarios'] }); setShowNew(false); showNotification('success', 'Scenario created'); },
    onError: () => showNotification('error', 'Failed to create scenario'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scenariosApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenarios'] }); setDeleteTarget(null); showNotification('success', 'Scenario deleted'); },
  });

  const maxALE = Math.max(...scenarios.map(s => s.latestSimulation?.statistics?.mean ?? 0), 1);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Risk Scenarios"
        actions={<button className="btn-primary" onClick={() => setShowNew(true)}>+ New Scenario</button>}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
        ) : scenarios.length === 0 ? (
          <EmptyState
            title="No risk scenarios yet"
            description="Create your first FAIR risk scenario to start quantifying your organization's risk exposure."
            action={<button className="btn-primary" onClick={() => setShowNew(true)}>Create First Scenario</button>}
            icon={<svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {scenarios.map(s => {
              const ale = s.latestSimulation?.statistics?.mean;
              const priority = ale ? aleToRiskPriority(ale, maxALE) : null;
              return (
                <div key={s.id} className="card hover:shadow-md transition-shadow relative group">
                  {/* Delete button */}
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>

                  <Link to={`/scenarios/${s.id}`} className="block">
                    <div className="flex items-start justify-between mb-2 pr-6">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug">{s.name}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{s.assetDescription}</p>

                    <div className="flex items-center gap-2 mb-3">
                      <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span>
                      {priority && <span className={`badge ${riskBadgeClass(priority)}`}>{priority} risk</span>}
                    </div>

                    {ale ? (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Mean ALE</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(ale, true)}</p>
                        {s.latestSimulation?.statistics?.confidenceIntervals?.['90'] && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            90% CI: {formatCurrency(s.latestSimulation.statistics.confidenceIntervals['90'].lower, true)} – {formatCurrency(s.latestSimulation.statistics.confidenceIntervals['90'].upper, true)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 rounded-lg p-3">
                        <p className="text-xs text-yellow-700">Simulation not yet run</p>
                      </div>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Risk Scenario" size="lg">
        <ScenarioForm
          onSubmit={createMutation.mutateAsync}
          onCancel={() => setShowNew(false)}
          isLoading={createMutation.isPending}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Scenario"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
