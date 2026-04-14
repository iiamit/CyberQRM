/**
 * MITRE ATT&CK Service
 *
 * Loads the Enterprise ATT&CK STIX bundle from a local file (downloaded at
 * install time) and exposes search / suggestion helpers used by the ATT&CK
 * routes. Gracefully degrades if the data file is absent.
 */

import path from 'path';
import fs from 'fs';
import { AttackTechniqueRef, AttackSuggestion } from '../../../shared/types/fair';

// ─── Prevalence data ──────────────────────────────────────────

interface PrevalenceTier {
  label: string;
  tef_min: number;
  tef_mode: number;
  tef_max: number;
}

interface PrevalenceData {
  tiers: Record<string, PrevalenceTier>;
  techniques: Record<string, { tier: number }>;
}

const prevalenceData: PrevalenceData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/attack-prevalence.json'), 'utf-8')
);

// ─── STIX object types (minimal) ─────────────────────────────

interface StixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  x_mitre_is_subtechnique?: boolean;
  x_mitre_platforms?: string[];
  x_mitre_deprecated?: boolean;
  revoked?: boolean;
  kill_chain_phases?: Array<{ kill_chain_name: string; phase_name: string }>;
  external_references?: Array<{ source_name: string; external_id?: string; url?: string }>;
  x_mitre_shortname?: string; // on x-mitre-tactic objects
}

interface StixRelationship {
  type: 'relationship';
  relationship_type: string;
  source_ref: string;
  target_ref: string;
}

interface StixBundle {
  type: 'bundle';
  objects: StixObject[];
}

// ─── Internal model ───────────────────────────────────────────

export interface AttackMitigation {
  id: string;
  name: string;
}

export interface AttackTechnique {
  stixId: string;
  id: string;          // "T1566.001"
  name: string;
  tactics: string[];   // tactic shortnames
  tacticNames: string[]; // human-readable tactic names
  platforms: string[];
  description: string;
  isSubtechnique: boolean;
  parentId?: string;
  mitigations: AttackMitigation[];
  groupCount: number;
  prevalenceTier?: number;
  tefSuggestion?: { min: number; mode: number; max: number };
}

export interface AttackTactic {
  id: string;           // "TA0001"
  name: string;         // "Initial Access"
  shortname: string;    // "initial-access"
}

// ─── Service state ────────────────────────────────────────────

let _available = false;
let _version = 'unknown';
let _techniques: AttackTechnique[] = [];
let _tactics: AttackTactic[] = [];
let _techniqueMap = new Map<string, AttackTechnique>(); // keyed by ATT&CK ID

const ATTACK_DATA_DIR = path.join(__dirname, '../../data/attack');
const ATTACK_VERSION = '17.1';
const ATTACK_FILE = path.join(ATTACK_DATA_DIR, `enterprise-attack-${ATTACK_VERSION}.json`);

// ─── Initialiser ─────────────────────────────────────────────

export function initAttackService(): void {
  if (!fs.existsSync(ATTACK_FILE)) {
    console.warn(`[ATT&CK] Data file not found: ${ATTACK_FILE}`);
    console.warn('[ATT&CK] Run ./install.sh (or install.bat) to download ATT&CK data.');
    console.warn('[ATT&CK] ATT&CK features will be unavailable until the file is present.');
    _available = false;
    return;
  }

  try {
    console.log('[ATT&CK] Loading STIX bundle…');
    const raw = fs.readFileSync(ATTACK_FILE, 'utf-8');
    const bundle: StixBundle = JSON.parse(raw);
    _parseBundle(bundle);
    _available = true;
    _version = ATTACK_VERSION;
    console.log(`[ATT&CK] Loaded ${_techniques.length} techniques, ${_tactics.length} tactics (v${_version})`);
  } catch (err) {
    console.error('[ATT&CK] Failed to parse STIX bundle:', err);
    _available = false;
  }
}

function _parseBundle(bundle: StixBundle): void {
  const objects = bundle.objects ?? [];

  // ── Build tactic lookup (shortname → AttackTactic)
  const tacticByShortname = new Map<string, AttackTactic>();
  for (const obj of objects) {
    if (obj.type === 'x-mitre-tactic' && obj.name && obj.x_mitre_shortname) {
      const extId = obj.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id ?? '';
      const tactic: AttackTactic = { id: extId, name: obj.name, shortname: obj.x_mitre_shortname };
      tacticByShortname.set(obj.x_mitre_shortname, tactic);
      _tactics.push(tactic);
    }
  }

  // ── Build STIX-id → ATT&CK ID lookup for mitigations and groups
  const stixToAttackId = new Map<string, string>();
  for (const obj of objects) {
    const extId = obj.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id;
    if (extId) stixToAttackId.set(obj.id, extId);
  }

  // ── Build mitigation map: stixId → {id, name}
  const mitigationByStixId = new Map<string, AttackMitigation>();
  for (const obj of objects) {
    if (obj.type === 'course-of-action' && !obj.x_mitre_deprecated && !obj.revoked) {
      const mId = stixToAttackId.get(obj.id);
      if (mId && obj.name) mitigationByStixId.set(obj.id, { id: mId, name: obj.name });
    }
  }

  // ── Build technique → mitigations map via relationships
  const techMitigations = new Map<string, AttackMitigation[]>();
  const techGroupCount = new Map<string, number>();

  for (const obj of objects) {
    if (obj.type !== 'relationship') continue;
    const rel = obj as unknown as StixRelationship;

    if (rel.relationship_type === 'mitigates') {
      // source = mitigation, target = technique
      const mit = mitigationByStixId.get(rel.source_ref);
      if (mit) {
        const list = techMitigations.get(rel.target_ref) ?? [];
        list.push(mit);
        techMitigations.set(rel.target_ref, list);
      }
    }

    if (rel.relationship_type === 'uses') {
      // source = group/software, target = technique
      const srcType = objects.find(o => o.id === rel.source_ref)?.type;
      if (srcType === 'intrusion-set') {
        techGroupCount.set(rel.target_ref, (techGroupCount.get(rel.target_ref) ?? 0) + 1);
      }
    }
  }

  // ── Build techniques
  for (const obj of objects) {
    if (obj.type !== 'attack-pattern') continue;
    if (obj.x_mitre_deprecated || obj.revoked) continue;

    const attackId = stixToAttackId.get(obj.id);
    if (!attackId) continue;

    const tacticShortnames = (obj.kill_chain_phases ?? [])
      .filter(p => p.kill_chain_name === 'mitre-attack')
      .map(p => p.phase_name);

    const tacticNames = tacticShortnames
      .map(s => tacticByShortname.get(s)?.name ?? s)
      .filter(Boolean);

    const prevEntry = prevalenceData.techniques[attackId];
    const tierNum = prevEntry?.tier;
    const tierData = tierNum ? prevalenceData.tiers[String(tierNum)] : undefined;

    const technique: AttackTechnique = {
      stixId: obj.id,
      id: attackId,
      name: obj.name ?? attackId,
      tactics: tacticShortnames,
      tacticNames,
      platforms: obj.x_mitre_platforms ?? [],
      description: (obj.description ?? '').substring(0, 500),
      isSubtechnique: obj.x_mitre_is_subtechnique ?? false,
      parentId: obj.x_mitre_is_subtechnique ? attackId.split('.')[0] : undefined,
      mitigations: techMitigations.get(obj.id) ?? [],
      groupCount: techGroupCount.get(obj.id) ?? 0,
      prevalenceTier: tierNum,
      tefSuggestion: tierData
        ? { min: tierData.tef_min, mode: tierData.tef_mode, max: tierData.tef_max }
        : undefined,
    };

    _techniques.push(technique);
    _techniqueMap.set(attackId, technique);
  }

  // Sort: parent techniques first, then sub-techniques; alphabetical within
  _techniques.sort((a, b) => {
    const aBase = a.isSubtechnique ? a.id.split('.')[0] : a.id;
    const bBase = b.isSubtechnique ? b.id.split('.')[0] : b.id;
    if (aBase !== bBase) return aBase.localeCompare(bBase);
    return a.id.localeCompare(b.id);
  });
}

// ─── Public accessors ─────────────────────────────────────────

export function isAttackAvailable(): boolean { return _available; }
export function getAttackVersion(): string { return _version; }

export function getTactics(): AttackTactic[] { return _tactics; }

export function searchTechniques(opts: {
  q?: string;
  tactic?: string;
  platform?: string;
  includeSubtechniques?: boolean;
}): AttackTechnique[] {
  const q = (opts.q ?? '').toLowerCase().trim();
  const tactic = opts.tactic?.toLowerCase().trim();
  const platform = opts.platform?.toLowerCase().trim();
  const includeSub = opts.includeSubtechniques !== false; // default true

  return _techniques.filter(t => {
    if (!includeSub && t.isSubtechnique) return false;
    if (tactic && !t.tactics.includes(tactic)) return false;
    if (platform && !t.platforms.some(p => p.toLowerCase().includes(platform))) return false;
    if (q) {
      const inId = t.id.toLowerCase().includes(q);
      const inName = t.name.toLowerCase().includes(q);
      const inDesc = t.description.toLowerCase().includes(q);
      if (!inId && !inName && !inDesc) return false;
    }
    return true;
  });
}

export function getTechniqueById(id: string): AttackTechnique | undefined {
  return _techniqueMap.get(id.toUpperCase());
}

// ─── TEF suggestion ───────────────────────────────────────────

export function suggestTEF(techniqueIds: string[]): AttackSuggestion | null {
  if (!_available || techniqueIds.length === 0) return null;

  // Use the highest-prevalence tier (lowest tier number = most common)
  let bestTier: number | undefined;
  for (const id of techniqueIds) {
    const t = _techniqueMap.get(id);
    const tier = t?.prevalenceTier;
    if (tier !== undefined && (bestTier === undefined || tier < bestTier)) {
      bestTier = tier;
    }
  }

  const tierData = bestTier !== undefined ? prevalenceData.tiers[String(bestTier)] : prevalenceData.tiers['3'];
  const label = tierData.label;

  return {
    distributionType: 'triangular',
    parameters: { min: tierData.tef_min, mode: tierData.tef_mode, max: tierData.tef_max },
    rationale: `Based on selected technique prevalence (${label}): observed in ${label.toLowerCase()} enterprise environments. Adjust based on your specific threat landscape.`,
  };
}

// ─── Vulnerability suggestion ─────────────────────────────────

export function suggestVulnerability(techniqueRefs: AttackTechniqueRef[]): AttackSuggestion | null {
  if (!_available || techniqueRefs.length === 0) return null;

  let totalMitigations = 0;
  let implementedMitigations = 0;

  for (const ref of techniqueRefs) {
    const tech = _techniqueMap.get(ref.techniqueId);
    if (!tech) continue;
    totalMitigations += tech.mitigations.length;
    implementedMitigations += (ref.implementedMitigations ?? []).length;
  }

  const coverage = totalMitigations > 0 ? implementedMitigations / totalMitigations : 0;
  const coveragePct = Math.round(coverage * 100);

  let params: { min: number; mode: number; max: number };
  let coverageLabel: string;

  if (coverage <= 0.2) {
    params = { min: 0.5, mode: 0.7, max: 0.9 };
    coverageLabel = 'minimal';
  } else if (coverage <= 0.4) {
    params = { min: 0.3, mode: 0.5, max: 0.7 };
    coverageLabel = 'partial';
  } else if (coverage <= 0.6) {
    params = { min: 0.2, mode: 0.35, max: 0.5 };
    coverageLabel = 'moderate';
  } else if (coverage <= 0.8) {
    params = { min: 0.1, mode: 0.2, max: 0.35 };
    coverageLabel = 'substantial';
  } else {
    params = { min: 0.05, mode: 0.1, max: 0.2 };
    coverageLabel = 'comprehensive';
  }

  return {
    distributionType: 'triangular',
    parameters: params,
    rationale: `${coveragePct}% of ATT&CK mitigations implemented (${coverageLabel} coverage). Higher coverage = lower vulnerability probability. Adjust based on control maturity and effectiveness.`,
  };
}
