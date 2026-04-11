import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { scenariosApi, portfoliosApi, controlsApi } from '../utils/api';
import { formatCurrency, aleToRiskPriority, riskBadgeClass, statusBadgeClass } from '../utils/formatting';
import { Spinner } from '../components/ui/Spinner';

export function Dashboard() {
  const { data: scenarios = [], isLoading: loadingS } = useQuery({ queryKey: ['scenarios'], queryFn: scenariosApi.list });
  const { data: portfolios = [], isLoading: loadingP } = useQuery({ queryKey: ['portfolios'], queryFn: portfoliosApi.list });
  const { data: controls = [], isLoading: loadingC } = useQuery({ queryKey: ['controls'], queryFn: controlsApi.list });

  const isLoading = loadingS || loadingP || loadingC;

  const totalALE = scenarios.reduce((sum, s) => sum + (s.latestSimulation?.statistics?.mean ?? 0), 0);
  const activeScenarios = scenarios.filter(s => s.status === 'active').length;
  const maxALE = Math.max(...scenarios.map(s => s.latestSimulation?.statistics?.mean ?? 0), 1);

  const topRisks = [...scenarios]
    .filter(s => s.latestSimulation?.statistics?.mean)
    .sort((a, b) => (b.latestSimulation!.statistics.mean) - (a.latestSimulation!.statistics.mean))
    .slice(0, 5);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Portfolio ALE', value: formatCurrency(totalALE, true), sub: 'Mean annualized loss', color: 'text-red-600', icon: '💸' },
          { label: 'Risk Scenarios', value: scenarios.length.toString(), sub: `${activeScenarios} simulated`, color: 'text-brand-600', icon: '🛡️' },
          { label: 'Portfolios', value: portfolios.length.toString(), sub: 'Active portfolios', color: 'text-purple-600', icon: '📁' },
          { label: 'Controls', value: controls.length.toString(), sub: 'Defined mitigations', color: 'text-green-600', icon: '⚙️' },
        ].map(card => (
          <div key={card.label} className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
              </div>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Risks */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Top Risk Scenarios</h2>
            <Link to="/scenarios" className="text-xs text-brand-600 hover:underline">View all →</Link>
          </div>
          {topRisks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              No simulated scenarios yet. <Link to="/scenarios" className="text-brand-600 hover:underline">Create one →</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {topRisks.map((s, i) => {
                const ale = s.latestSimulation!.statistics.mean;
                const priority = aleToRiskPriority(ale, maxALE);
                return (
                  <Link key={s.id} to={`/scenarios/${s.id}`} className="block hover:bg-gray-50 rounded-lg -mx-2 px-2 py-2 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="text-sm font-medium text-gray-800 truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={`badge ${riskBadgeClass(priority)}`}>{priority}</span>
                        <span className="text-sm font-bold text-gray-700">{formatCurrency(ale, true)}</span>
                      </div>
                    </div>
                    <div className="mt-1 ml-7">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${priority === 'critical' ? 'bg-red-500' : priority === 'high' ? 'bg-orange-500' : priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${(ale / maxALE) * 100}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Scenarios */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Recent Scenarios</h2>
            <Link to="/scenarios/new" className="btn-primary text-xs py-1.5 px-3">+ New</Link>
          </div>
          {scenarios.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No scenarios yet.</p>
          ) : (
            <div className="space-y-2">
              {scenarios.slice(0, 6).map(s => (
                <Link key={s.id} to={`/scenarios/${s.id}`} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500 truncate">{s.assetDescription}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span>
                    {s.latestSimulation && (
                      <span className="text-xs text-gray-700 font-medium">{formatCurrency(s.latestSimulation.statistics.mean, true)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      {scenarios.length === 0 && (
        <div className="card bg-gradient-to-br from-brand-50 to-blue-50 border-brand-200">
          <h3 className="font-semibold text-brand-800 mb-2">Get Started with FAIR Risk Quantification</h3>
          <p className="text-sm text-brand-700 mb-4">
            Create your first risk scenario by defining the four FAIR components (Threat Event Frequency,
            Vulnerability, Asset Value, Loss Event Impact) and run a Monte Carlo simulation.
          </p>
          <Link to="/scenarios/new" className="btn-primary">Create First Scenario →</Link>
        </div>
      )}
    </div>
  );
}
