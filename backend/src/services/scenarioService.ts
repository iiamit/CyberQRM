import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { RiskScenario, SimulationConfig } from '../../../shared/types/fair';
import { runMonteCarloSimulation, runSensitivityAnalysis, SimulationInput } from './simulationEngine';

// ─── Helpers ──────────────────────────────────────────────────

function parseJSON<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

function rowToScenario(row: any): RiskScenario {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description ?? '',
    assetDescription: row.assetDescription ?? '',
    businessContext: row.businessContext ?? '',
    status: row.status ?? 'draft',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy ?? 'user',
    simulationConfig: parseJSON<SimulationConfig>(row.simulationConfig, { iterations: 10000, confidenceIntervals: [90, 95] }),
  };
}

// ─── Scenario CRUD ────────────────────────────────────────────

export function listScenarios(orgId: string): RiskScenario[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM risk_scenarios WHERE organizationId = ? ORDER BY updatedAt DESC').all(orgId) as any[];
  const scenarios = rows.map(rowToScenario);

  for (const s of scenarios) {
    attachComponents(s);
    attachLatestSimulation(s);
  }
  return scenarios;
}

export function getScenario(id: string): RiskScenario | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM risk_scenarios WHERE id = ?').get(id) as any;
  if (!row) return null;
  const scenario = rowToScenario(row);
  attachComponents(scenario);
  attachLatestSimulation(scenario);
  return scenario;
}

export function createScenario(data: Partial<RiskScenario>): RiskScenario {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO risk_scenarios (id, organizationId, name, description, assetDescription, businessContext, status, simulationConfig, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.organizationId ?? 'default-org',
    data.name ?? 'New Scenario',
    data.description ?? '',
    data.assetDescription ?? '',
    data.businessContext ?? '',
    data.status ?? 'draft',
    JSON.stringify(data.simulationConfig ?? { iterations: 10000, confidenceIntervals: [90, 95] }),
    now,
    now
  );

  // Save FAIR components if provided at creation time
  if (data.threatEventFrequency) upsertTEF(id, data.threatEventFrequency);
  if (data.vulnerability) upsertVulnerability(id, data.vulnerability);
  if (data.assetValue) upsertAssetValue(id, data.assetValue);
  if (data.lossEventImpact) upsertLossEventImpact(id, data.lossEventImpact);

  return getScenario(id)!;
}

export function updateScenario(id: string, data: Partial<RiskScenario>): RiskScenario | null {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM risk_scenarios WHERE id = ?').get(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.assetDescription !== undefined) { fields.push('assetDescription = ?'); values.push(data.assetDescription); }
  if (data.businessContext !== undefined) { fields.push('businessContext = ?'); values.push(data.businessContext); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.simulationConfig !== undefined) { fields.push('simulationConfig = ?'); values.push(JSON.stringify(data.simulationConfig)); }

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE risk_scenarios SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // Upsert FAIR components
  if (data.threatEventFrequency) upsertTEF(id, data.threatEventFrequency);
  if (data.vulnerability) upsertVulnerability(id, data.vulnerability);
  if (data.assetValue) upsertAssetValue(id, data.assetValue);
  if (data.lossEventImpact) upsertLossEventImpact(id, data.lossEventImpact);

  return getScenario(id);
}

export function deleteScenario(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM risk_scenarios WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── FAIR Component Upserts ───────────────────────────────────

function upsertTEF(scenarioId: string, data: any) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM threat_event_frequencies WHERE scenarioId = ?').get(scenarioId) as any;
  const attackTechniques = JSON.stringify(data.attackTechniques ?? []);
  if (existing) {
    db.prepare(`
      UPDATE threat_event_frequencies SET name=?, description=?, distributionType=?, parameters=?, notes=?, attackTechniques=? WHERE scenarioId=?
    `).run(data.name ?? 'Threat Event Frequency', data.description ?? '', data.distributionType, JSON.stringify(data.parameters), data.notes ?? '', attackTechniques, scenarioId);
  } else {
    db.prepare(`
      INSERT INTO threat_event_frequencies (id, scenarioId, name, description, distributionType, parameters, notes, attackTechniques)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), scenarioId, data.name ?? 'Threat Event Frequency', data.description ?? '', data.distributionType, JSON.stringify(data.parameters), data.notes ?? '', attackTechniques);
  }
}

function upsertVulnerability(scenarioId: string, data: any) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM vulnerabilities WHERE scenarioId = ?').get(scenarioId) as any;
  const attackTechniques = JSON.stringify(data.attackTechniques ?? []);
  if (existing) {
    db.prepare(`
      UPDATE vulnerabilities SET name=?, description=?, distributionType=?, parameters=?, relatedControls=?, notes=?, attackTechniques=? WHERE scenarioId=?
    `).run(data.name ?? 'Vulnerability', data.description ?? '', data.distributionType, JSON.stringify(data.parameters), JSON.stringify(data.relatedControls ?? []), data.notes ?? '', attackTechniques, scenarioId);
  } else {
    db.prepare(`
      INSERT INTO vulnerabilities (id, scenarioId, name, description, distributionType, parameters, relatedControls, notes, attackTechniques)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), scenarioId, data.name ?? 'Vulnerability', data.description ?? '', data.distributionType, JSON.stringify(data.parameters), JSON.stringify(data.relatedControls ?? []), data.notes ?? '', attackTechniques);
  }
}

function upsertAssetValue(scenarioId: string, data: any) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM asset_values WHERE scenarioId = ?').get(scenarioId) as any;
  const useMultipleBases = data.useMultipleBases ? 1 : 0;
  const valuationBases = JSON.stringify(data.valuationBases ?? []);
  if (existing) {
    db.prepare(`
      UPDATE asset_values SET name=?, description=?, distributionType=?, parameters=?, valuationBasis=?, notes=?, useMultipleBases=?, valuationBases=? WHERE scenarioId=?
    `).run(data.name ?? 'Asset Value', data.description ?? '', data.distributionType, JSON.stringify(data.parameters), data.valuationBasis ?? '', data.notes ?? '', useMultipleBases, valuationBases, scenarioId);
  } else {
    db.prepare(`
      INSERT INTO asset_values (id, scenarioId, name, description, distributionType, parameters, valuationBasis, notes, useMultipleBases, valuationBases)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), scenarioId, data.name ?? 'Asset Value', data.description ?? '', data.distributionType, JSON.stringify(data.parameters), data.valuationBasis ?? '', data.notes ?? '', useMultipleBases, valuationBases);
  }
}

function upsertLossEventImpact(scenarioId: string, data: any) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM loss_event_impacts WHERE scenarioId = ?').get(scenarioId) as any;
  const useAdvancedLoss = data.useAdvancedLoss ? 1 : 0;
  const primaryLossComponents = JSON.stringify(data.primaryLossComponents ?? []);
  const slef = data.slef ? JSON.stringify(data.slef) : null;
  const secondaryLossEnabled = data.secondaryLossEnabled ? 1 : 0;
  const secondaryLossComponents = JSON.stringify(data.secondaryLossComponents ?? []);
  if (existing) {
    db.prepare(`
      UPDATE loss_event_impacts SET name=?, description=?, distributionType=?, parameters=?, impactComponents=?, notes=?,
        useAdvancedLoss=?, primaryLossComponents=?, slef=?, secondaryLossEnabled=?, secondaryLossComponents=?
      WHERE scenarioId=?
    `).run(data.name ?? 'Loss Event Impact', data.description ?? '', data.distributionType, JSON.stringify(data.parameters), JSON.stringify(data.impactComponents ?? []), data.notes ?? '', useAdvancedLoss, primaryLossComponents, slef, secondaryLossEnabled, secondaryLossComponents, scenarioId);
  } else {
    db.prepare(`
      INSERT INTO loss_event_impacts (id, scenarioId, name, description, distributionType, parameters, impactComponents, notes,
        useAdvancedLoss, primaryLossComponents, slef, secondaryLossEnabled, secondaryLossComponents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), scenarioId, data.name ?? 'Loss Event Impact', data.description ?? '', data.distributionType, JSON.stringify(data.parameters), JSON.stringify(data.impactComponents ?? []), data.notes ?? '', useAdvancedLoss, primaryLossComponents, slef, secondaryLossEnabled, secondaryLossComponents);
  }
}

// ─── Component Attachment ─────────────────────────────────────

function attachComponents(scenario: RiskScenario) {
  const db = getDb();
  const id = scenario.id;

  const tef = db.prepare('SELECT * FROM threat_event_frequencies WHERE scenarioId = ?').get(id) as any;
  if (tef) {
    scenario.threatEventFrequency = {
      ...tef,
      parameters: parseJSON(tef.parameters, {}),
      notes: tef.notes ?? '',
      attackTechniques: parseJSON(tef.attackTechniques, []),
    };
  }

  const vuln = db.prepare('SELECT * FROM vulnerabilities WHERE scenarioId = ?').get(id) as any;
  if (vuln) {
    scenario.vulnerability = {
      ...vuln,
      parameters: parseJSON(vuln.parameters, {}),
      relatedControls: parseJSON(vuln.relatedControls, []),
      notes: vuln.notes ?? '',
      attackTechniques: parseJSON(vuln.attackTechniques, []),
    };
  }

  const av = db.prepare('SELECT * FROM asset_values WHERE scenarioId = ?').get(id) as any;
  if (av) {
    scenario.assetValue = {
      ...av,
      parameters: parseJSON(av.parameters, {}),
      notes: av.notes ?? '',
      useMultipleBases: !!av.useMultipleBases,
      valuationBases: parseJSON(av.valuationBases, []),
    };
  }

  const lei = db.prepare('SELECT * FROM loss_event_impacts WHERE scenarioId = ?').get(id) as any;
  if (lei) {
    scenario.lossEventImpact = {
      ...lei,
      parameters: parseJSON(lei.parameters, {}),
      impactComponents: parseJSON(lei.impactComponents, []),
      notes: lei.notes ?? '',
      useAdvancedLoss: !!lei.useAdvancedLoss,
      primaryLossComponents: parseJSON(lei.primaryLossComponents, []),
      slef: lei.slef ? parseJSON(lei.slef, null) : undefined,
      secondaryLossEnabled: !!lei.secondaryLossEnabled,
      secondaryLossComponents: parseJSON(lei.secondaryLossComponents, []),
    };
  }
}

function attachLatestSimulation(scenario: RiskScenario) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM simulation_results WHERE scenarioId = ? ORDER BY runAt DESC LIMIT 1').get(scenario.id) as any;
  if (row) {
    scenario.latestSimulation = {
      id: row.id,
      scenarioId: row.scenarioId,
      runAt: row.runAt,
      status: row.status,
      statistics: parseJSON(row.statistics, {} as any),
      rawSamples: parseJSON(row.rawSamples, []),
      convergenceMetrics: parseJSON(row.convergenceMetrics, {} as any),
      simulationConfig: parseJSON(row.simulationConfig, scenario.simulationConfig),
    };
  }
}

// ─── Simulation ───────────────────────────────────────────────

export function runSimulation(scenarioId: string): { result: any; sensitivity?: any } {
  const scenario = getScenario(scenarioId);
  if (!scenario) throw new Error('Scenario not found');

  const { threatEventFrequency, vulnerability, assetValue, lossEventImpact, simulationConfig } = scenario;
  if (!threatEventFrequency || !vulnerability || !assetValue || !lossEventImpact) {
    throw new Error('All four FAIR components (TEF, Vulnerability, Asset Value, Loss Event Impact) must be defined before running simulation');
  }

  const input: SimulationInput = {
    scenarioId,
    tef: threatEventFrequency,
    vulnerability,
    assetValue,
    lossEventImpact,
    config: simulationConfig,
  };

  const result = runMonteCarloSimulation(input);

  // Persist result
  const db = getDb();
  db.prepare(`
    INSERT INTO simulation_results (id, scenarioId, runAt, status, statistics, rawSamples, convergenceMetrics, simulationConfig)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    result.id,
    result.scenarioId,
    result.runAt,
    result.status,
    JSON.stringify(result.statistics),
    JSON.stringify(result.rawSamples),
    JSON.stringify(result.convergenceMetrics),
    JSON.stringify(result.simulationConfig)
  );

  // Update scenario status to active
  db.prepare('UPDATE risk_scenarios SET status = ?, updatedAt = ? WHERE id = ?').run(
    'active', new Date().toISOString(), scenarioId
  );

  // Compute sensitivity
  const sensitivity = runSensitivityAnalysis(scenario, result.statistics.mean);

  return { result, sensitivity };
}

export function getLatestSimulation(scenarioId: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM simulation_results WHERE scenarioId = ? ORDER BY runAt DESC LIMIT 1').get(scenarioId) as any;
  if (!row) return null;
  return {
    ...row,
    statistics: parseJSON(row.statistics, {}),
    rawSamples: parseJSON(row.rawSamples, []),
    convergenceMetrics: parseJSON(row.convergenceMetrics, {}),
    simulationConfig: parseJSON(row.simulationConfig, {}),
  };
}
