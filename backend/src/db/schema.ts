export const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default org
INSERT OR IGNORE INTO organizations (id, name) VALUES ('default-org', 'My Organization');

-- Risk Scenarios
CREATE TABLE IF NOT EXISTS risk_scenarios (
  id               TEXT PRIMARY KEY,
  organizationId   TEXT NOT NULL DEFAULT 'default-org',
  name             TEXT NOT NULL,
  description      TEXT DEFAULT '',
  assetDescription TEXT DEFAULT '',
  businessContext  TEXT DEFAULT '',
  status           TEXT DEFAULT 'draft',
  createdAt        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt        DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdBy        TEXT DEFAULT 'user',
  simulationConfig TEXT DEFAULT '{"iterations":10000,"confidenceIntervals":[90,95]}',
  FOREIGN KEY (organizationId) REFERENCES organizations(id)
);

-- Threat Event Frequencies
CREATE TABLE IF NOT EXISTS threat_event_frequencies (
  id               TEXT PRIMARY KEY,
  scenarioId       TEXT NOT NULL UNIQUE,
  name             TEXT DEFAULT 'Threat Event Frequency',
  description      TEXT DEFAULT '',
  distributionType TEXT NOT NULL DEFAULT 'triangular',
  parameters       TEXT NOT NULL DEFAULT '{}',
  notes            TEXT DEFAULT '',
  FOREIGN KEY (scenarioId) REFERENCES risk_scenarios(id) ON DELETE CASCADE
);

-- Vulnerabilities
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id               TEXT PRIMARY KEY,
  scenarioId       TEXT NOT NULL UNIQUE,
  name             TEXT DEFAULT 'Vulnerability',
  description      TEXT DEFAULT '',
  distributionType TEXT NOT NULL DEFAULT 'triangular',
  parameters       TEXT NOT NULL DEFAULT '{}',
  relatedControls  TEXT DEFAULT '[]',
  notes            TEXT DEFAULT '',
  FOREIGN KEY (scenarioId) REFERENCES risk_scenarios(id) ON DELETE CASCADE
);

-- Asset Values
CREATE TABLE IF NOT EXISTS asset_values (
  id               TEXT PRIMARY KEY,
  scenarioId       TEXT NOT NULL UNIQUE,
  name             TEXT DEFAULT 'Asset Value',
  description      TEXT DEFAULT '',
  distributionType TEXT NOT NULL DEFAULT 'triangular',
  parameters       TEXT NOT NULL DEFAULT '{}',
  valuationBasis   TEXT DEFAULT '',
  notes            TEXT DEFAULT '',
  FOREIGN KEY (scenarioId) REFERENCES risk_scenarios(id) ON DELETE CASCADE
);

-- Loss Event Impacts
CREATE TABLE IF NOT EXISTS loss_event_impacts (
  id               TEXT PRIMARY KEY,
  scenarioId       TEXT NOT NULL UNIQUE,
  name             TEXT DEFAULT 'Loss Event Impact',
  description      TEXT DEFAULT '',
  distributionType TEXT NOT NULL DEFAULT 'triangular',
  parameters       TEXT NOT NULL DEFAULT '{}',
  impactComponents TEXT DEFAULT '[]',
  notes            TEXT DEFAULT '',
  FOREIGN KEY (scenarioId) REFERENCES risk_scenarios(id) ON DELETE CASCADE
);

-- Simulation Results
CREATE TABLE IF NOT EXISTS simulation_results (
  id                 TEXT PRIMARY KEY,
  scenarioId         TEXT NOT NULL,
  runAt              DATETIME DEFAULT CURRENT_TIMESTAMP,
  status             TEXT DEFAULT 'pending',
  statistics         TEXT DEFAULT '{}',
  rawSamples         TEXT DEFAULT '[]',
  convergenceMetrics TEXT DEFAULT '{}',
  simulationConfig   TEXT DEFAULT '{}',
  FOREIGN KEY (scenarioId) REFERENCES risk_scenarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sim_results_scenario ON simulation_results(scenarioId, runAt DESC);

-- Controls / Mitigations
CREATE TABLE IF NOT EXISTS controls (
  id                           TEXT PRIMARY KEY,
  organizationId               TEXT NOT NULL DEFAULT 'default-org',
  name                         TEXT NOT NULL,
  description                  TEXT DEFAULT '',
  category                     TEXT DEFAULT 'preventive',
  targetComponent              TEXT DEFAULT 'vulnerability',
  currentImplemented           INTEGER DEFAULT 0,
  currentMaturityLevel         INTEGER DEFAULT 1,
  currentEffectiveness         REAL DEFAULT 0.0,
  proposedImplemented          INTEGER DEFAULT 1,
  proposedMaturityLevel        INTEGER DEFAULT 3,
  proposedEffectiveness        REAL DEFAULT 0.5,
  estimatedImplementationCost  REAL DEFAULT 0,
  estimatedAnnualCost          REAL DEFAULT 0,
  timelineMonths               INTEGER DEFAULT 6,
  createdAt                    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizationId) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_controls_org ON controls(organizationId);

-- Control <-> Scenario impact projections
CREATE TABLE IF NOT EXISTS control_scenario_impacts (
  controlId            TEXT NOT NULL,
  scenarioId           TEXT NOT NULL,
  currentALE           REAL DEFAULT 0,
  projectedALE         REAL DEFAULT 0,
  aleReduction         REAL DEFAULT 0,
  aleReductionPercent  REAL DEFAULT 0,
  roi                  REAL DEFAULT 0,
  paybackPeriodMonths  INTEGER DEFAULT 0,
  PRIMARY KEY (controlId, scenarioId),
  FOREIGN KEY (controlId)  REFERENCES controls(id)       ON DELETE CASCADE,
  FOREIGN KEY (scenarioId) REFERENCES risk_scenarios(id) ON DELETE CASCADE
);

-- Portfolios
CREATE TABLE IF NOT EXISTS portfolios (
  id             TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'default-org',
  name           TEXT NOT NULL,
  description    TEXT DEFAULT '',
  status         TEXT DEFAULT 'draft',
  createdAt      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizationId) REFERENCES organizations(id)
);

-- Portfolio <-> Scenario membership
CREATE TABLE IF NOT EXISTS portfolio_scenarios (
  portfolioId TEXT NOT NULL,
  scenarioId  TEXT NOT NULL,
  PRIMARY KEY (portfolioId, scenarioId),
  FOREIGN KEY (portfolioId) REFERENCES portfolios(id)     ON DELETE CASCADE,
  FOREIGN KEY (scenarioId)  REFERENCES risk_scenarios(id) ON DELETE CASCADE
);
`;
