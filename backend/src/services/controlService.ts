import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { Control } from '../../../shared/types/fair';
import { getScenario, getLatestSimulation } from './scenarioService';
import { projectControlImpact } from './simulationEngine';

function parseJSON<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

function rowToControl(row: any): Control {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description ?? '',
    category: row.category ?? 'preventive',
    targetComponent: row.targetComponent ?? 'vulnerability',
    currentState: {
      implemented: row.currentImplemented === 1,
      maturityLevel: row.currentMaturityLevel ?? 1,
      effectiveness: row.currentEffectiveness ?? 0,
    },
    proposedState: {
      implemented: row.proposedImplemented === 1,
      maturityLevel: row.proposedMaturityLevel ?? 3,
      effectiveness: row.proposedEffectiveness ?? 0.5,
      estimatedImplementationCost: row.estimatedImplementationCost ?? 0,
      estimatedAnnualCost: row.estimatedAnnualCost ?? 0,
      timelineMonths: row.timelineMonths ?? 6,
    },
    impactProjections: [],
    createdAt: row.createdAt,
  };
}

export function listControls(orgId: string): Control[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM controls WHERE organizationId = ? ORDER BY createdAt DESC').all(orgId) as any[];
  const controls = rows.map(rowToControl);
  for (const c of controls) {
    c.impactProjections = loadImpactProjections(c.id);
  }
  return controls;
}

export function getControl(id: string): Control | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM controls WHERE id = ?').get(id) as any;
  if (!row) return null;
  const control = rowToControl(row);
  control.impactProjections = loadImpactProjections(id);
  return control;
}

function loadImpactProjections(controlId: string) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM control_scenario_impacts WHERE controlId = ?').all(controlId) as any[];
  return rows.map(r => ({
    scenarioId: r.scenarioId,
    currentALE: r.currentALE,
    projectedALE: r.projectedALE,
    aleReduction: r.aleReduction,
    aleReductionPercent: r.aleReductionPercent,
    roi: r.roi,
    paybackPeriodMonths: r.paybackPeriodMonths,
  }));
}

export function createControl(data: Partial<Control>): Control {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO controls (id, organizationId, name, description, category, targetComponent,
      currentImplemented, currentMaturityLevel, currentEffectiveness,
      proposedImplemented, proposedMaturityLevel, proposedEffectiveness,
      estimatedImplementationCost, estimatedAnnualCost, timelineMonths, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.organizationId ?? 'default-org',
    data.name ?? 'New Control',
    data.description ?? '',
    data.category ?? 'preventive',
    data.targetComponent ?? 'vulnerability',
    data.currentState?.implemented ? 1 : 0,
    data.currentState?.maturityLevel ?? 1,
    data.currentState?.effectiveness ?? 0,
    data.proposedState?.implemented ? 1 : 0,
    data.proposedState?.maturityLevel ?? 3,
    data.proposedState?.effectiveness ?? 0.5,
    data.proposedState?.estimatedImplementationCost ?? 0,
    data.proposedState?.estimatedAnnualCost ?? 0,
    data.proposedState?.timelineMonths ?? 6,
    now
  );
  return getControl(id)!;
}

export function updateControl(id: string, data: Partial<Control>): Control | null {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM controls WHERE id = ?').get(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE controls SET name=?, description=?, category=?, targetComponent=?,
      currentImplemented=?, currentMaturityLevel=?, currentEffectiveness=?,
      proposedImplemented=?, proposedMaturityLevel=?, proposedEffectiveness=?,
      estimatedImplementationCost=?, estimatedAnnualCost=?, timelineMonths=?
    WHERE id=?
  `).run(
    data.name ?? 'Control',
    data.description ?? '',
    data.category ?? 'preventive',
    data.targetComponent ?? 'vulnerability',
    data.currentState?.implemented ? 1 : 0,
    data.currentState?.maturityLevel ?? 1,
    data.currentState?.effectiveness ?? 0,
    data.proposedState?.implemented ? 1 : 0,
    data.proposedState?.maturityLevel ?? 3,
    data.proposedState?.effectiveness ?? 0.5,
    data.proposedState?.estimatedImplementationCost ?? 0,
    data.proposedState?.estimatedAnnualCost ?? 0,
    data.proposedState?.timelineMonths ?? 6,
    id
  );
  return getControl(id);
}

export function deleteControl(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM controls WHERE id = ?').run(id).changes > 0;
}

export function calculateControlImpact(controlId: string, scenarioId: string) {
  const control = getControl(controlId);
  if (!control) throw new Error('Control not found');

  const scenario = getScenario(scenarioId);
  if (!scenario) throw new Error('Scenario not found');

  const simResult = getLatestSimulation(scenarioId);
  if (!simResult) throw new Error('No simulation results found for scenario – run simulation first');

  const baseALE = simResult.statistics.mean;

  const impact = projectControlImpact(
    scenario,
    baseALE,
    control.proposedState.effectiveness,
    control.targetComponent,
    control.proposedState.estimatedImplementationCost,
    control.proposedState.estimatedAnnualCost,
    control.proposedState.timelineMonths,
    scenario.simulationConfig
  );

  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO control_scenario_impacts
      (controlId, scenarioId, currentALE, projectedALE, aleReduction, aleReductionPercent, roi, paybackPeriodMonths)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    controlId,
    scenarioId,
    impact.currentALE,
    impact.projectedALE,
    impact.aleReduction,
    impact.aleReductionPercent,
    impact.roi,
    impact.paybackPeriodMonths
  );

  return impact;
}
