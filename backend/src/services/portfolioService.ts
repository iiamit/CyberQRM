import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { Portfolio, PortfolioAnalysis, CommonThreat, CommonVulnerability, RiskPriority } from '../../../shared/types/fair';
import { getScenario, getLatestSimulation } from './scenarioService';

function parseJSON<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

export function listPortfolios(orgId: string): Portfolio[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM portfolios WHERE organizationId = ? ORDER BY updatedAt DESC').all(orgId) as any[];
  return rows.map(r => ({
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    description: r.description ?? '',
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    riskScenarios: getPortfolioScenarioIds(r.id),
  }));
}

export function getPortfolio(id: string): Portfolio | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(id) as any;
  if (!row) return null;

  const scenarioIds = getPortfolioScenarioIds(id);
  const portfolio: Portfolio = {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    riskScenarios: scenarioIds,
  };

  portfolio.portfolioAnalysis = computePortfolioAnalysis(scenarioIds);
  return portfolio;
}

function getPortfolioScenarioIds(portfolioId: string): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT scenarioId FROM portfolio_scenarios WHERE portfolioId = ?').all(portfolioId) as any[];
  return rows.map(r => r.scenarioId);
}

export function createPortfolio(data: Partial<Portfolio>): Portfolio {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO portfolios (id, organizationId, name, description, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.organizationId ?? 'default-org', data.name ?? 'New Portfolio', data.description ?? '', data.status ?? 'draft', now, now);

  if (data.riskScenarios?.length) {
    for (const sid of data.riskScenarios) {
      db.prepare('INSERT OR IGNORE INTO portfolio_scenarios (portfolioId, scenarioId) VALUES (?, ?)').run(id, sid);
    }
  }

  return getPortfolio(id)!;
}

export function updatePortfolio(id: string, data: Partial<Portfolio>): Portfolio | null {
  const db = getDb();
  if (!db.prepare('SELECT id FROM portfolios WHERE id = ?').get(id)) return null;

  const now = new Date().toISOString();
  db.prepare('UPDATE portfolios SET name=?, description=?, status=?, updatedAt=? WHERE id=?').run(
    data.name ?? 'Portfolio',
    data.description ?? '',
    data.status ?? 'draft',
    now,
    id
  );

  if (data.riskScenarios !== undefined) {
    db.prepare('DELETE FROM portfolio_scenarios WHERE portfolioId = ?').run(id);
    for (const sid of data.riskScenarios) {
      db.prepare('INSERT OR IGNORE INTO portfolio_scenarios (portfolioId, scenarioId) VALUES (?, ?)').run(id, sid);
    }
  }

  return getPortfolio(id);
}

export function deletePortfolio(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM portfolios WHERE id = ?').run(id).changes > 0;
}

// ─── Portfolio Analysis ───────────────────────────────────────

function computePortfolioAnalysis(scenarioIds: string[]): PortfolioAnalysis {
  const aleByScenario: Record<string, number> = {};
  let totalALE = 0;

  const scenarioData: Array<{ id: string; name: string; ale: number; tef?: string; vuln?: string }> = [];

  for (const sid of scenarioIds) {
    const sim = getLatestSimulation(sid);
    const scenario = getScenario(sid);
    if (!scenario) continue;
    const ale = sim?.statistics?.mean ?? 0;
    aleByScenario[sid] = ale;
    totalALE += ale;
    scenarioData.push({
      id: sid,
      name: scenario.name,
      ale,
      tef: scenario.threatEventFrequency?.description,
      vuln: scenario.vulnerability?.description,
    });
  }

  const topRisks = scenarioData
    .sort((a, b) => b.ale - a.ale)
    .slice(0, 10)
    .map(s => ({
      riskScenarioId: s.id,
      name: s.name,
      ale: s.ale,
      alePercent: totalALE > 0 ? (s.ale / totalALE) * 100 : 0,
    }));

  const commonThreats = identifyCommonThreats(scenarioData, totalALE);
  const commonVulnerabilities = identifyCommonVulnerabilities(scenarioData, totalALE);

  return { totalALE, aleByScenario, topRisks, commonThreats, commonVulnerabilities };
}

function aleToRiskPriority(ale: number, totalALE: number): RiskPriority {
  const pct = totalALE > 0 ? ale / totalALE : 0;
  if (pct > 0.25) return 'critical';
  if (pct > 0.1) return 'high';
  if (pct > 0.05) return 'medium';
  return 'low';
}

function identifyCommonThreats(
  data: Array<{ id: string; name: string; ale: number; tef?: string }>,
  totalALE: number
): CommonThreat[] {
  // Group by threat description keywords (simplified approach)
  const groups: Record<string, { scenarios: string[]; ale: number }> = {};

  for (const s of data) {
    const key = normalizeThreatKey(s.tef ?? s.name);
    if (!groups[key]) groups[key] = { scenarios: [], ale: 0 };
    groups[key].scenarios.push(s.id);
    groups[key].ale += s.ale;
  }

  return Object.entries(groups)
    .filter(([, v]) => v.ale > 0)
    .map(([k, v]) => ({
      threatDescription: k,
      affectedScenarios: v.scenarios,
      combinedALE: v.ale,
      priority: aleToRiskPriority(v.ale, totalALE),
    }))
    .sort((a, b) => b.combinedALE - a.combinedALE)
    .slice(0, 10);
}

function identifyCommonVulnerabilities(
  data: Array<{ id: string; name: string; ale: number; vuln?: string }>,
  totalALE: number
): CommonVulnerability[] {
  const groups: Record<string, { scenarios: string[]; ale: number }> = {};

  for (const s of data) {
    const key = normalizeVulnKey(s.vuln ?? s.name);
    if (!groups[key]) groups[key] = { scenarios: [], ale: 0 };
    groups[key].scenarios.push(s.id);
    groups[key].ale += s.ale;
  }

  return Object.entries(groups)
    .filter(([, v]) => v.ale > 0)
    .map(([k, v]) => ({
      vulnerabilityDescription: k,
      affectedScenarios: v.scenarios,
      combinedALE: v.ale,
      priority: aleToRiskPriority(v.ale, totalALE),
    }))
    .sort((a, b) => b.combinedALE - a.combinedALE)
    .slice(0, 10);
}

function normalizeThreatKey(desc: string): string {
  // Normalise to first ~5 words for grouping
  return desc.trim().split(/\s+/).slice(0, 5).join(' ') || 'General Threat';
}

function normalizeVulnKey(desc: string): string {
  return desc.trim().split(/\s+/).slice(0, 5).join(' ') || 'General Vulnerability';
}

// ─── Cross-scenario control impact ───────────────────────────

export function getPortfolioControlImpactSummary(portfolioId: string) {
  const db = getDb();
  const scenarioIds = getPortfolioScenarioIds(portfolioId);
  if (!scenarioIds.length) return [];

  const placeholders = scenarioIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT c.id, c.name, c.category,
           c.estimatedImplementationCost, c.estimatedAnnualCost,
           SUM(csi.aleReduction) as totalAleReduction,
           COUNT(csi.scenarioId) as affectedScenarioCount
    FROM controls c
    JOIN control_scenario_impacts csi ON csi.controlId = c.id
    WHERE csi.scenarioId IN (${placeholders})
    GROUP BY c.id
    ORDER BY totalAleReduction DESC
  `).all(...scenarioIds) as any[];

  return rows.map(r => {
    const threeYearBenefit = r.totalAleReduction * 3;
    const threeYearCost = r.estimatedImplementationCost + r.estimatedAnnualCost * 3;
    const roi = threeYearCost > 0 ? ((threeYearBenefit - threeYearCost) / threeYearCost) * 100 : 0;
    return {
      controlId: r.id,
      controlName: r.name,
      category: r.category,
      affectedScenarioCount: r.affectedScenarioCount,
      totalAleReduction: r.totalAleReduction,
      implementationCost: r.estimatedImplementationCost,
      roi,
    };
  });
}
