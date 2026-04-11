import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portfoliosApi, scenariosApi } from '../utils/api';
import { formatCurrency, riskBadgeClass } from '../utils/formatting';
import { Header } from '../components/layout/Header';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../store/appStore';
import { Portfolio } from '@shared/types/fair';

function PortfolioCard({ portfolio, onSelect, onDelete }: { portfolio: Portfolio; onSelect: () => void; onDelete: () => void }) {
  const analysis = portfolio.portfolioAnalysis;
  return (
    <div className="card hover:shadow-md transition-shadow cursor-pointer group relative" onClick={onSelect}>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
      <h3 className="font-semibold text-gray-900 mb-1 pr-6">{portfolio.name}</h3>
      {portfolio.description && <p className="text-xs text-gray-500 mb-3">{portfolio.description}</p>}
      <div className="flex gap-3 text-xs">
        <span className="badge badge-blue">{portfolio.riskScenarios.length} scenarios</span>
        {analysis && <span className="font-semibold text-red-600">{formatCurrency(analysis.totalALE, true)} ALE</span>}
      </div>
    </div>
  );
}

function PortfolioDetail({ portfolioId, onClose }: { portfolioId: string; onClose: () => void }) {
  const { data: portfolio } = useQuery({
    queryKey: ['portfolio', portfolioId],
    queryFn: () => portfoliosApi.get(portfolioId),
  });
  const { data: controlImpact = [] } = useQuery({
    queryKey: ['portfolio-control-impact', portfolioId],
    queryFn: () => portfoliosApi.controlImpactSummary(portfolioId),
  });

  if (!portfolio) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const a = portfolio.portfolioAnalysis;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-500">Total Portfolio ALE</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(a?.totalALE ?? 0, true)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-500">Risk Scenarios</p>
          <p className="text-2xl font-bold text-brand-600">{portfolio.riskScenarios.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-500">High-Impact Controls</p>
          <p className="text-2xl font-bold text-green-600">{controlImpact.length}</p>
        </div>
      </div>

      {/* Top risks */}
      {a?.topRisks?.length ? (
        <div>
          <h3 className="section-title">Top Risks by ALE</h3>
          <div className="space-y-2">
            {a.topRisks.slice(0, 5).map((r, i) => (
              <div key={r.riskScenarioId} className="flex items-center gap-3 py-2">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 truncate">{r.name}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-gray-500">{r.alePercent.toFixed(1)}%</span>
                      <span className="text-sm font-bold text-gray-700">{formatCurrency(r.ale, true)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${r.alePercent}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Common Threats */}
      {a?.commonThreats?.length ? (
        <div>
          <h3 className="section-title">Common Threat Patterns</h3>
          <div className="space-y-2">
            {a.commonThreats.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`badge ${riskBadgeClass(t.priority)}`}>{t.priority}</span>
                  <span className="text-sm text-gray-700 truncate">{t.threatDescription}</span>
                </div>
                <div className="flex items-center gap-3 ml-2 flex-shrink-0 text-xs text-gray-500">
                  <span>{t.affectedScenarios.length} scenarios</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(t.combinedALE, true)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Common Vulnerabilities */}
      {a?.commonVulnerabilities?.length ? (
        <div>
          <h3 className="section-title">Common Vulnerability Patterns</h3>
          <div className="space-y-2">
            {a.commonVulnerabilities.map((v, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`badge ${riskBadgeClass(v.priority)}`}>{v.priority}</span>
                  <span className="text-sm text-gray-700 truncate">{v.vulnerabilityDescription}</span>
                </div>
                <div className="flex items-center gap-3 ml-2 flex-shrink-0 text-xs text-gray-500">
                  <span>{v.affectedScenarios.length} scenarios</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(v.combinedALE, true)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Control Impact */}
      {controlImpact.length > 0 && (
        <div>
          <h3 className="section-title">High-ROI Controls (Multi-Scenario)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs text-gray-500 font-medium">Control</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Scenarios</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Total ALE Reduction</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Impl. Cost</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Portfolio ROI</th>
                </tr>
              </thead>
              <tbody>
                {controlImpact.map((ci: any) => (
                  <tr key={ci.controlId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-800">{ci.controlName}</td>
                    <td className="py-2 text-right text-gray-500">{ci.affectedScenarioCount}</td>
                    <td className="py-2 text-right text-green-700 font-medium">{formatCurrency(ci.totalAleReduction, true)}</td>
                    <td className="py-2 text-right text-gray-600">{formatCurrency(ci.implementationCost, true)}</td>
                    <td className="py-2 text-right font-bold text-green-700">{ci.roi.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    </div>
  );
}

function CreatePortfolioForm({ scenarios, onSubmit, onCancel, isLoading }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, description, riskScenarios: selected }); }} className="space-y-4">
      <div>
        <label className="label">Portfolio Name *</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., Q2 2026 Risk Portfolio" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input resize-none" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label">Select Scenarios</label>
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {scenarios.map((s: any) => (
            <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="rounded" />
              <span className="text-sm flex-1 min-w-0 truncate">{s.name}</span>
              {s.latestSimulation?.statistics?.mean != null && (
                <span className="text-xs text-gray-400">{formatCurrency(s.latestSimulation.statistics.mean, true)}</span>
              )}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">{selected.length} selected</p>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading || !name}>
          {isLoading ? 'Creating...' : 'Create Portfolio'}
        </button>
      </div>
    </form>
  );
}

export function Portfolios() {
  const qc = useQueryClient();
  const { showNotification } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [viewPortfolio, setViewPortfolio] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Portfolio | null>(null);

  const { data: portfolios = [], isLoading } = useQuery({ queryKey: ['portfolios'], queryFn: portfoliosApi.list });
  const { data: scenarios = [] } = useQuery({ queryKey: ['scenarios'], queryFn: scenariosApi.list });

  const createMutation = useMutation({
    mutationFn: portfoliosApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolios'] }); setShowNew(false); showNotification('success', 'Portfolio created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => portfoliosApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolios'] }); setDeleteTarget(null); showNotification('success', 'Portfolio deleted'); },
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Risk Portfolios"
        actions={<button className="btn-primary" onClick={() => setShowNew(true)}>+ New Portfolio</button>}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
        ) : portfolios.length === 0 ? (
          <EmptyState
            title="No portfolios yet"
            description="Group risk scenarios into portfolios to see aggregated risk, identify common threats, and prioritize controls."
            action={<button className="btn-primary" onClick={() => setShowNew(true)}>Create Portfolio</button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {portfolios.map(p => (
              <PortfolioCard
                key={p.id}
                portfolio={p}
                onSelect={() => setViewPortfolio(p.id)}
                onDelete={() => setDeleteTarget(p)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Portfolio" size="md">
        <CreatePortfolioForm
          scenarios={scenarios}
          onSubmit={createMutation.mutateAsync}
          onCancel={() => setShowNew(false)}
          isLoading={createMutation.isPending}
        />
      </Modal>

      <Modal open={!!viewPortfolio} onClose={() => setViewPortfolio(null)} title="Portfolio Analysis" size="xl">
        {viewPortfolio && <PortfolioDetail portfolioId={viewPortfolio} onClose={() => setViewPortfolio(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Portfolio"
        message={`Delete "${deleteTarget?.name}"? This will not delete the underlying scenarios.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
