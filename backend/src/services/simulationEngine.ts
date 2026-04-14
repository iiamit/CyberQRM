/**
 * FAIR v3.1 Monte Carlo Simulation Engine
 *
 * Implements sampling for Triangular, Lognormal, and Point distributions,
 * then runs the FAIR calculation tree to produce a distribution of ALE values.
 */

import {
  ThreatEventFrequency,
  Vulnerability,
  AssetValue,
  LossEventImpact,
  SimulationConfig,
  SimulationResults,
  SimulationStatistics,
  PercentileMap,
  ConfidenceIntervalMap,
  ConvergenceMetrics,
  SensitivityResult,
  FAIRComponentKey,
  RiskScenario,
} from '../../../shared/types/fair';
import { v4 as uuidv4 } from 'uuid';

// ─── Seeded PRNG (Mulberry32) ─────────────────────────────────

function mulberry32(seed: number) {
  return function (): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Distribution Samplers ────────────────────────────────────

/**
 * Sample from a triangular distribution using inverse CDF method.
 */
export function sampleTriangular(min: number, mode: number, max: number, rng: () => number): number {
  if (min === max) return min;
  const u = rng();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/**
 * Sample from a lognormal distribution.
 * Parameterised by: median and 90th percentile.
 * We derive mu (log-median) and sigma from these two values.
 */
export function sampleLognormal(median: number, percentile90: number, rng: () => number): number {
  if (median <= 0) median = 0.001;
  const mu = Math.log(median);
  // P(X <= p90) = 0.90  → z_{0.90} ≈ 1.2816
  const z90 = 1.2816;
  const sigma = (Math.log(percentile90) - mu) / z90;
  const clampedSigma = Math.max(sigma, 0.001);

  // Box-Muller
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + clampedSigma * z);
}

/** Sample a point estimate – always returns the value. */
export function samplePoint(value: number): number {
  return value;
}

// ─── Generic component sampler ────────────────────────────────

type ComponentLike = ThreatEventFrequency | Vulnerability | AssetValue | LossEventImpact;

export function sampleComponent(component: { distributionType: string; parameters: any }, rng: () => number): number {
  const { distributionType, parameters } = component;
  switch (distributionType) {
    case 'triangular': {
      const { min, mode, max } = parameters;
      return sampleTriangular(min, mode, max, rng);
    }
    case 'lognormal': {
      const { median, percentile90 } = parameters;
      return sampleLognormal(median, percentile90, rng);
    }
    case 'point': {
      const { value } = parameters;
      return samplePoint(value);
    }
    default:
      throw new Error(`Unknown distribution type: ${distributionType}`);
  }
}

// ─── Multi-basis Asset Value sampler ─────────────────────────

function sampleAssetValue(av: AssetValue, rng: () => number): number {
  if (av.useMultipleBases && av.valuationBases && av.valuationBases.length > 0) {
    return av.valuationBases.reduce(
      (sum, basis) => sum + Math.max(0, sampleComponent(basis as any, rng)),
      0
    );
  }
  return Math.max(0, sampleComponent(av as any, rng));
}

// ─── Primary/Secondary Loss Magnitude sampler ─────────────────

function sampleLossMagnitude(lei: LossEventImpact, avVal: number, rng: () => number): number {
  if (lei.useAdvancedLoss && lei.primaryLossComponents && lei.primaryLossComponents.length > 0) {
    // Primary loss: sum of absolute dollar distributions
    const plm = lei.primaryLossComponents.reduce(
      (sum, c) => sum + Math.max(0, sampleComponent(c as any, rng)),
      0
    );

    // Secondary loss: SLEF × Σ secondary distributions
    let slm = 0;
    if (lei.secondaryLossEnabled && lei.slef && lei.secondaryLossComponents && lei.secondaryLossComponents.length > 0) {
      const slef = Math.min(1, Math.max(0, sampleComponent(lei.slef as any, rng)));
      const slem = lei.secondaryLossComponents.reduce(
        (sum, c) => sum + Math.max(0, sampleComponent(c as any, rng)),
        0
      );
      slm = slef * slem;
    }

    return plm + slm;
  }

  // Simple mode (backward compatible): fraction of asset value
  return avVal * Math.min(1, Math.max(0, sampleComponent(lei as any, rng)));
}

// ─── Statistics Helpers ───────────────────────────────────────

function percentile(sorted: Float64Array, p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function mean(arr: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function stdDev(arr: Float64Array, avg: number): number {
  let variance = 0;
  for (let i = 0; i < arr.length; i++) {
    const diff = arr[i] - avg;
    variance += diff * diff;
  }
  return Math.sqrt(variance / arr.length);
}

function computeConvergence(samples: Float64Array): ConvergenceMetrics {
  // Check if mean stabilises after halfway point
  const half = Math.floor(samples.length / 2);
  const firstHalfMean = mean(samples.slice(0, half));
  const secondHalfMean = mean(samples.slice(half));
  const diff = Math.abs(firstHalfMean - secondHalfMean) / (firstHalfMean || 1);
  return {
    meanStabilized: diff < 0.05,
    iterationsNeeded: samples.length,
  };
}

// ─── Main Monte Carlo Function ────────────────────────────────

export interface SimulationInput {
  scenarioId: string;
  tef: ThreatEventFrequency;
  vulnerability: Vulnerability;
  assetValue: AssetValue;
  lossEventImpact: LossEventImpact;
  config: SimulationConfig;
}

export function runMonteCarloSimulation(input: SimulationInput): SimulationResults {
  const { scenarioId, tef, vulnerability, assetValue, lossEventImpact, config } = input;
  const iterations = config.iterations ?? 10000;
  const seed = config.randomSeed ?? Math.floor(Math.random() * 0xffffffff);
  const rng = mulberry32(seed);

  const samples = new Float64Array(iterations);

  for (let i = 0; i < iterations; i++) {
    const tefVal = Math.max(0, sampleComponent(tef as any, rng));
    const vulnVal = Math.min(1, Math.max(0, sampleComponent(vulnerability as any, rng)));
    const lef = tefVal * vulnVal;

    const avVal = sampleAssetValue(assetValue, rng);
    const lm = sampleLossMagnitude(lossEventImpact, avVal, rng);

    samples[i] = lef * lm;
  }

  // Sort for percentile calculations
  const sorted = samples.slice().sort();

  const avg = mean(samples);
  const med = percentile(sorted, 50);

  const statistics: SimulationStatistics = {
    mean: avg,
    median: med,
    stdDev: stdDev(samples, avg),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    percentiles: {
      '10': percentile(sorted, 10),
      '25': percentile(sorted, 25),
      '50': med,
      '75': percentile(sorted, 75),
      '90': percentile(sorted, 90),
      '95': percentile(sorted, 95),
      '99': percentile(sorted, 99),
    },
    confidenceIntervals: {
      '90': {
        lower: percentile(sorted, 5),
        upper: percentile(sorted, 95),
      },
      '95': {
        lower: percentile(sorted, 2.5),
        upper: percentile(sorted, 97.5),
      },
    },
  };

  return {
    id: uuidv4(),
    scenarioId,
    runAt: new Date().toISOString(),
    status: 'complete',
    statistics,
    rawSamples: Array.from(samples),
    convergenceMetrics: computeConvergence(samples),
    simulationConfig: { ...config, randomSeed: seed },
  };
}

// ─── Sensitivity Analysis ─────────────────────────────────────

/**
 * Vary each FAIR component by ±stdDev (or ±20% for point estimates)
 * and measure impact on mean ALE.
 */
export function runSensitivityAnalysis(
  scenario: RiskScenario,
  baseALE: number
): SensitivityResult[] {
  const config = scenario.simulationConfig ?? { iterations: 5000, confidenceIntervals: [90] };
  const fastConfig = { ...config, iterations: 3000 };

  const components: FAIRComponentKey[] = ['tef', 'vulnerability', 'assetValue', 'lei'];
  const results: SensitivityResult[] = [];

  for (const key of components) {
    const lower = cloneAndShift(scenario, key, -0.2);
    const upper = cloneAndShift(scenario, key, 0.2);

    const lowerResult = runMonteCarloSimulation({
      scenarioId: scenario.id,
      tef: lower.threatEventFrequency!,
      vulnerability: lower.vulnerability!,
      assetValue: lower.assetValue!,
      lossEventImpact: lower.lossEventImpact!,
      config: fastConfig,
    });

    const upperResult = runMonteCarloSimulation({
      scenarioId: scenario.id,
      tef: upper.threatEventFrequency!,
      vulnerability: upper.vulnerability!,
      assetValue: upper.assetValue!,
      lossEventImpact: upper.lossEventImpact!,
      config: fastConfig,
    });

    const lowerALE = lowerResult.statistics.mean;
    const upperALE = upperResult.statistics.mean;

    results.push({
      parameterName: keyLabel(key),
      parameterKey: key,
      baseALE,
      lowerALE,
      upperALE,
      lowerImpactPercent: baseALE > 0 ? ((lowerALE - baseALE) / baseALE) * 100 : 0,
      upperImpactPercent: baseALE > 0 ? ((upperALE - baseALE) / baseALE) * 100 : 0,
    });
  }

  return results.sort(
    (a, b) =>
      Math.abs(b.upperALE - b.lowerALE) - Math.abs(a.upperALE - a.lowerALE)
  );
}

function keyLabel(key: FAIRComponentKey): string {
  switch (key) {
    case 'tef': return 'Threat Event Frequency';
    case 'vulnerability': return 'Vulnerability';
    case 'assetValue': return 'Asset Value';
    case 'lei': return 'Loss Event Impact';
  }
}

function cloneAndShift(scenario: RiskScenario, key: FAIRComponentKey, factor: number): RiskScenario {
  const clone: RiskScenario = JSON.parse(JSON.stringify(scenario));
  switch (key) {
    case 'tef':
      shiftComponent(clone.threatEventFrequency! as any, factor);
      break;
    case 'vulnerability':
      shiftComponent(clone.vulnerability! as any, factor, true);
      break;
    case 'assetValue':
      shiftAssetValue(clone.assetValue!, factor);
      break;
    case 'lei':
      shiftLossEventImpact(clone.lossEventImpact!, factor);
      break;
  }
  return clone;
}

function shiftParams(p: any, factor: number, clamp01 = false): void {
  const shift = (v: number) => {
    const r = v * (1 + factor);
    return clamp01 ? Math.min(1, Math.max(0, r)) : Math.max(0, r);
  };
  if ('min' in p) {
    p.min = shift(p.min);
    p.mode = shift(p.mode);
    p.max = shift(p.max);
  } else if ('median' in p) {
    p.median = shift(p.median);
    p.percentile90 = shift(p.percentile90);
  } else if ('value' in p) {
    p.value = shift(p.value);
  }
}

function shiftComponent(c: { parameters: any }, factor: number, clamp01 = false): void {
  shiftParams(c.parameters, factor, clamp01);
}

function shiftAssetValue(av: AssetValue, factor: number): void {
  if (av.useMultipleBases && av.valuationBases?.length) {
    av.valuationBases.forEach(b => shiftParams(b.parameters, factor));
  } else {
    shiftParams((av as any).parameters, factor);
  }
}

function shiftLossEventImpact(lei: LossEventImpact, factor: number): void {
  if (lei.useAdvancedLoss && lei.primaryLossComponents?.length) {
    lei.primaryLossComponents.forEach(c => shiftParams(c.parameters, factor));
    lei.secondaryLossComponents?.forEach(c => shiftParams(c.parameters, factor));
    if (lei.slef) shiftParams((lei.slef as any).parameters, factor, true);
  } else {
    shiftParams((lei as any).parameters, factor, true);
  }
}

// ─── Control Impact Projection ────────────────────────────────

export function projectControlImpact(
  scenario: RiskScenario,
  baseALE: number,
  proposedEffectiveness: number,
  targetComponent: FAIRComponentKey,
  implementationCost: number,
  annualCost: number,
  timelineMonths: number,
  config: SimulationConfig
): {
  currentALE: number;
  projectedALE: number;
  aleReduction: number;
  aleReductionPercent: number;
  roi: number;
  paybackPeriodMonths: number;
} {
  // Clone scenario and reduce the target component by the proposed effectiveness
  const modified = cloneWithEffectiveness(scenario, targetComponent, proposedEffectiveness);

  const result = runMonteCarloSimulation({
    scenarioId: scenario.id,
    tef: modified.threatEventFrequency!,
    vulnerability: modified.vulnerability!,
    assetValue: modified.assetValue!,
    lossEventImpact: modified.lossEventImpact!,
    config: { ...config, iterations: 5000 },
  });

  const projectedALE = result.statistics.mean;
  const aleReduction = baseALE - projectedALE;
  const aleReductionPercent = baseALE > 0 ? (aleReduction / baseALE) * 100 : 0;

  const threeYearBenefit = aleReduction * 3;
  const threeYearCost = implementationCost + annualCost * 3;
  const roi = threeYearCost > 0 ? ((threeYearBenefit - threeYearCost) / threeYearCost) * 100 : 0;

  const monthlyALEReduction = aleReduction / 12;
  const paybackPeriodMonths =
    monthlyALEReduction > 0
      ? Math.ceil(implementationCost / monthlyALEReduction)
      : 999;

  return {
    currentALE: baseALE,
    projectedALE,
    aleReduction,
    aleReductionPercent,
    roi,
    paybackPeriodMonths,
  };
}

function cloneWithEffectiveness(
  scenario: RiskScenario,
  key: FAIRComponentKey,
  effectiveness: number
): RiskScenario {
  const clone: RiskScenario = JSON.parse(JSON.stringify(scenario));
  const factor = -(1 - (1 - effectiveness));
  switch (key) {
    case 'tef':
      shiftComponent(clone.threatEventFrequency! as any, factor);
      break;
    case 'vulnerability':
      shiftComponent(clone.vulnerability! as any, factor, true);
      break;
    case 'assetValue':
      shiftAssetValue(clone.assetValue!, factor);
      break;
    case 'lei':
      shiftLossEventImpact(clone.lossEventImpact!, factor);
      break;
  }
  return clone;
}
