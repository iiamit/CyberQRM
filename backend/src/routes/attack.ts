import { Router, Request, Response } from 'express';
import {
  isAttackAvailable,
  getAttackVersion,
  getTactics,
  searchTechniques,
  getTechniqueById,
  suggestTEF,
  suggestVulnerability,
} from '../services/attackService';
import { AttackTechniqueRef } from '../../../shared/types/fair';

const router = Router();

// GET /api/attack/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({ available: isAttackAvailable(), version: getAttackVersion() });
});

// GET /api/attack/tactics
router.get('/tactics', (_req: Request, res: Response) => {
  if (!isAttackAvailable()) return res.json({ available: false, tactics: [] });
  res.json({ available: true, tactics: getTactics() });
});

// GET /api/attack/techniques
// Query params: q, tactic, platform, includeSubtechniques (default true)
router.get('/techniques', (req: Request, res: Response) => {
  if (!isAttackAvailable()) return res.json({ available: false, techniques: [] });

  const { q, tactic, platform, includeSubtechniques } = req.query as Record<string, string>;
  const results = searchTechniques({
    q,
    tactic,
    platform,
    includeSubtechniques: includeSubtechniques !== 'false',
  });

  // Cap at 200 results to keep response lean
  res.json({ available: true, techniques: results.slice(0, 200), total: results.length });
});

// GET /api/attack/techniques/:id
router.get('/techniques/:id', (req: Request, res: Response) => {
  if (!isAttackAvailable()) return res.status(503).json({ error: 'ATT&CK data unavailable' });
  const tech = getTechniqueById(req.params.id);
  if (!tech) return res.status(404).json({ error: 'Technique not found' });
  res.json(tech);
});

// POST /api/attack/suggest/tef
// Body: { techniqueIds: string[] }
router.post('/suggest/tef', (req: Request, res: Response) => {
  if (!isAttackAvailable()) return res.status(503).json({ error: 'ATT&CK data unavailable' });
  const { techniqueIds } = req.body as { techniqueIds: string[] };
  if (!Array.isArray(techniqueIds) || techniqueIds.length === 0) {
    return res.status(400).json({ error: 'techniqueIds must be a non-empty array' });
  }
  const suggestion = suggestTEF(techniqueIds);
  if (!suggestion) return res.status(404).json({ error: 'No suggestion available' });
  res.json(suggestion);
});

// POST /api/attack/suggest/vuln
// Body: { techniqueRefs: AttackTechniqueRef[] }
router.post('/suggest/vuln', (req: Request, res: Response) => {
  if (!isAttackAvailable()) return res.status(503).json({ error: 'ATT&CK data unavailable' });
  const { techniqueRefs } = req.body as { techniqueRefs: AttackTechniqueRef[] };
  if (!Array.isArray(techniqueRefs) || techniqueRefs.length === 0) {
    return res.status(400).json({ error: 'techniqueRefs must be a non-empty array' });
  }
  const suggestion = suggestVulnerability(techniqueRefs);
  if (!suggestion) return res.status(404).json({ error: 'No suggestion available' });
  res.json(suggestion);
});

export default router;
