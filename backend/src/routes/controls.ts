import { Router, Request, Response, NextFunction } from 'express';
import {
  listControls,
  getControl,
  createControl,
  updateControl,
  deleteControl,
  calculateControlImpact,
} from '../services/controlService';

const router = Router();
const ORG_ID = 'default-org';

router.get('/', (_req: Request, res: Response) => {
  res.json({ data: listControls(ORG_ID) });
});

router.post('/', (req: Request, res: Response) => {
  const control = createControl({ ...req.body, organizationId: ORG_ID });
  res.status(201).json({ data: control });
});

router.get('/:id', (req: Request, res: Response) => {
  const control = getControl(req.params.id);
  if (!control) return res.status(404).json({ error: 'Control not found' });
  res.json({ data: control });
});

router.put('/:id', (req: Request, res: Response) => {
  const control = updateControl(req.params.id, req.body);
  if (!control) return res.status(404).json({ error: 'Control not found' });
  res.json({ data: control });
});

router.delete('/:id', (req: Request, res: Response) => {
  const deleted = deleteControl(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Control not found' });
  res.json({ message: 'Control deleted' });
});

router.post('/:id/scenarios/:scenarioId/impact', (req: Request, res: Response, next: NextFunction) => {
  try {
    const impact = calculateControlImpact(req.params.id, req.params.scenarioId);
    res.json({ data: impact });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('No simulation')) {
      res.status(400).json({ error: err.message });
    } else {
      next(err);
    }
  }
});

export default router;
