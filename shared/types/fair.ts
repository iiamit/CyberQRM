// ─────────────────────────────────────────────────────────────
// FAIR v3.1 Core Data Types
// ─────────────────────────────────────────────────────────────

export type DistributionType = 'triangular' | 'lognormal' | 'point';

export type ScenarioStatus = 'draft' | 'active' | 'archived';

export type ControlCategory = 'preventive' | 'detective' | 'corrective' | 'compensating';

export type SimulationStatus = 'pending' | 'running' | 'complete' | 'error';

export type ImpactComponentType = 'confidentiality' | 'integrity' | 'availability' | 'other';

export type RiskPriority = 'critical' | 'high' | 'medium' | 'low';

// ─── Distribution Parameter Shapes ───────────────────────────

export interface TriangularParams {
  min: number;
  mode: number;
  max: number;
}

export interface LognormalParams {
  median: number;
  percentile90: number;
}

export interface PointParams {
  value: number;
}

export type DistributionParams =
  | { distributionType: 'triangular'; parameters: TriangularParams }
  | { distributionType: 'lognormal'; parameters: LognormalParams }
  | { distributionType: 'point'; parameters: PointParams };

// ─── MITRE ATT&CK ─────────────────────────────────────────────

export interface AttackTechniqueRef {
  techniqueId: string;              // e.g. "T1566.001"
  name: string;
  tactics: string[];
  rationale?: string;
  implementedMitigations?: string[]; // e.g. ["M1017", "M1031"]
}

// ─── Multi-Basis Asset Valuation ─────────────────────────────

export type ValuationBasis =
  | 'replacement_cost'
  | 'revenue_impact'
  | 'regulatory_exposure'
  | 'business_interruption'
  | 'reputational'
  | 'custom';

export interface ValuationEntry {
  id: string;
  basis: ValuationBasis;
  customBasisLabel?: string;
  description?: string;
  distributionType: DistributionType;
  parameters: TriangularParams | LognormalParams | PointParams;
  notes?: string;
}

// ─── Primary / Secondary Loss ─────────────────────────────────

export type PrimaryLossForm = 'productivity' | 'response' | 'replacement' | 'other';
export type SecondaryLossForm = 'competitive_advantage' | 'fines_judgements' | 'reputation' | 'other';

export interface LossComponent {
  id: string;
  form: PrimaryLossForm | SecondaryLossForm;
  customLabel?: string;
  description?: string;
  distributionType: DistributionType;
  parameters: TriangularParams | LognormalParams | PointParams;
  notes?: string;
}

export interface SlefDistribution {
  distributionType: DistributionType;
  parameters: TriangularParams | LognormalParams | PointParams;
}

// ─── FAIR Components ─────────────────────────────────────────

export interface ThreatEventFrequency {
  id: string;
  scenarioId: string;
  name: string;
  description: string;
  distributionType: DistributionType;
  parameters: TriangularParams | LognormalParams | PointParams;
  unitLabel: string;
  notes: string;
  attackTechniques?: AttackTechniqueRef[];
}

export interface Vulnerability {
  id: string;
  scenarioId: string;
  name: string;
  description: string;
  distributionType: DistributionType;
  parameters: TriangularParams | LognormalParams | PointParams;
  unitLabel: string;
  relatedControls: Array<{
    controlId: string;
    controlName: string;
    estimatedEffectiveness: number;
  }>;
  notes: string;
  attackTechniques?: AttackTechniqueRef[];
}

export interface AssetValue {
  id: string;
  scenarioId: string;
  name: string;
  description: string;
  distributionType: DistributionType;
  parameters: TriangularParams | PointParams;
  unitLabel: string;
  valuationBasis: string;
  notes: string;
  // Advanced multi-basis mode
  useMultipleBases?: boolean;
  valuationBases?: ValuationEntry[];
}

export interface LossEventImpact {
  id: string;
  scenarioId: string;
  name: string;
  description: string;
  distributionType: DistributionType;
  parameters: TriangularParams | PointParams;
  unitLabel: string;
  impactComponents: Array<{
    type: ImpactComponentType;
    description: string;
    estimatedImpact: number;
  }>;
  notes: string;
  // Advanced primary/secondary loss mode
  useAdvancedLoss?: boolean;
  primaryLossComponents?: LossComponent[];
  slef?: SlefDistribution;
  secondaryLossEnabled?: boolean;
  secondaryLossComponents?: LossComponent[];
}

// ─── Simulation ───────────────────────────────────────────────

export interface SimulationConfig {
  iterations: number;
  randomSeed?: number;
  confidenceIntervals: number[];
}

export interface PercentileMap {
  '10': number;
  '25': number;
  '50': number;
  '75': number;
  '90': number;
  '95': number;
  '99': number;
}

export interface ConfidenceIntervalMap {
  '90': { lower: number; upper: number };
  '95': { lower: number; upper: number };
}

export interface SimulationStatistics {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  percentiles: PercentileMap;
  confidenceIntervals: ConfidenceIntervalMap;
}

export interface ConvergenceMetrics {
  meanStabilized: boolean;
  iterationsNeeded: number;
}

export interface SimulationResults {
  id: string;
  scenarioId: string;
  runAt: string;
  status: SimulationStatus;
  statistics: SimulationStatistics;
  rawSamples: number[];
  convergenceMetrics: ConvergenceMetrics;
  simulationConfig: SimulationConfig;
}

// ─── Risk Scenario ────────────────────────────────────────────

export interface RiskScenario {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  assetDescription: string;
  businessContext: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: ScenarioStatus;
  threatEventFrequency?: ThreatEventFrequency;
  vulnerability?: Vulnerability;
  assetValue?: AssetValue;
  lossEventImpact?: LossEventImpact;
  simulationConfig: SimulationConfig;
  latestSimulation?: SimulationResults;
}

// ─── Control / Mitigation ────────────────────────────────────

export interface ControlState {
  implemented: boolean;
  maturityLevel: number;
  effectiveness: number;
}

export interface ControlProposedState extends ControlState {
  estimatedImplementationCost: number;
  estimatedAnnualCost: number;
  timelineMonths: number;
}

export interface ControlImpactProjection {
  scenarioId: string;
  currentALE: number;
  projectedALE: number;
  aleReduction: number;
  aleReductionPercent: number;
  roi: number;
  paybackPeriodMonths: number;
}

export interface Control {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  category: ControlCategory;
  targetComponent: 'tef' | 'vulnerability' | 'assetValue' | 'lei';
  currentState: ControlState;
  proposedState: ControlProposedState;
  impactProjections: ControlImpactProjection[];
  createdAt: string;
}

// ─── Portfolio ────────────────────────────────────────────────

export interface TopRisk {
  riskScenarioId: string;
  name: string;
  ale: number;
  alePercent: number;
}

export interface CommonThreat {
  threatDescription: string;
  affectedScenarios: string[];
  combinedALE: number;
  priority: RiskPriority;
}

export interface CommonVulnerability {
  vulnerabilityDescription: string;
  affectedScenarios: string[];
  combinedALE: number;
  priority: RiskPriority;
}

export interface PortfolioAnalysis {
  totalALE: number;
  aleByScenario: Record<string, number>;
  topRisks: TopRisk[];
  commonThreats: CommonThreat[];
  commonVulnerabilities: CommonVulnerability[];
}

export interface Portfolio {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  riskScenarios: string[];
  createdAt: string;
  updatedAt: string;
  status: ScenarioStatus;
  portfolioAnalysis?: PortfolioAnalysis;
}

// ─── Sensitivity Analysis ─────────────────────────────────────

export type FAIRComponentKey = 'tef' | 'vulnerability' | 'assetValue' | 'lei';

export interface SensitivityResult {
  parameterName: string;
  parameterKey: FAIRComponentKey;
  baseALE: number;
  lowerALE: number;
  upperALE: number;
  lowerImpactPercent: number;
  upperImpactPercent: number;
}

// ─── ATT&CK API types ─────────────────────────────────────────

export interface AttackMitigation {
  id: string;   // "M1017"
  name: string;
}

export interface AttackTechniqueSummary {
  id: string;           // "T1566.001"
  name: string;
  tactics: string[];
  platforms: string[];
  description: string;
  isSubtechnique: boolean;
  parentId?: string;
  mitigations: AttackMitigation[];
  groupCount: number;
  prevalenceTier?: number; // 1=very common … 4=rare
  tefSuggestion?: { min: number; mode: number; max: number };
}

export interface AttackSuggestion {
  distributionType: 'triangular';
  parameters: { min: number; mode: number; max: number };
  rationale: string;
}

// ─── API Response shapes ──────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
