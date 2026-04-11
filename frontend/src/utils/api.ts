import axios from 'axios';
import { RiskScenario, Control, Portfolio } from '@shared/types/fair';

const api = axios.create({ baseURL: '/api' });

// ─── Scenarios ────────────────────────────────────────────────
export const scenariosApi = {
  list: ()                        => api.get<{ data: RiskScenario[] }>('/scenarios').then(r => r.data.data),
  get:  (id: string)              => api.get<{ data: RiskScenario }>(`/scenarios/${id}`).then(r => r.data.data),
  create: (payload: Partial<RiskScenario>) => api.post<{ data: RiskScenario }>('/scenarios', payload).then(r => r.data.data),
  update: (id: string, payload: Partial<RiskScenario>) => api.put<{ data: RiskScenario }>(`/scenarios/${id}`, payload).then(r => r.data.data),
  delete: (id: string)            => api.delete(`/scenarios/${id}`),
  simulate: (id: string)          => api.post(`/scenarios/${id}/simulate`).then(r => r.data.data),
  getResults: (id: string)        => api.get(`/scenarios/${id}/results`).then(r => r.data.data),
};

// ─── Controls ─────────────────────────────────────────────────
export const controlsApi = {
  list: ()                        => api.get<{ data: Control[] }>('/controls').then(r => r.data.data),
  get:  (id: string)              => api.get<{ data: Control }>(`/controls/${id}`).then(r => r.data.data),
  create: (payload: Partial<Control>) => api.post<{ data: Control }>('/controls', payload).then(r => r.data.data),
  update: (id: string, payload: Partial<Control>) => api.put<{ data: Control }>(`/controls/${id}`, payload).then(r => r.data.data),
  delete: (id: string)            => api.delete(`/controls/${id}`),
  calculateImpact: (controlId: string, scenarioId: string) =>
    api.post(`/controls/${controlId}/scenarios/${scenarioId}/impact`).then(r => r.data.data),
};

// ─── Portfolios ───────────────────────────────────────────────
export const portfoliosApi = {
  list: ()                        => api.get<{ data: Portfolio[] }>('/portfolios').then(r => r.data.data),
  get:  (id: string)              => api.get<{ data: Portfolio }>(`/portfolios/${id}`).then(r => r.data.data),
  create: (payload: Partial<Portfolio>) => api.post<{ data: Portfolio }>('/portfolios', payload).then(r => r.data.data),
  update: (id: string, payload: Partial<Portfolio>) => api.put<{ data: Portfolio }>(`/portfolios/${id}`, payload).then(r => r.data.data),
  delete: (id: string)            => api.delete(`/portfolios/${id}`),
  controlImpactSummary: (id: string) => api.get(`/portfolios/${id}/control-impact-summary`).then(r => r.data.data),
};

export default api;
