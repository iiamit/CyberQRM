import { Router, Request, Response } from 'express';
import {
  listPortfolios,
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  getPortfolioControlImpactSummary,
} from '../services/portfolioService';

const router = Router();
const ORG_ID = 'default-org';

router.get('/', (_req: Request, res: Response) => {
  res.json({ data: listPortfolios(ORG_ID) });
});

router.post('/', (req: Request, res: Response) => {
  const portfolio = createPortfolio({ ...req.body, organizationId: ORG_ID });
  res.status(201).json({ data: portfolio });
});

router.get('/:id', (req: Request, res: Response) => {
  const portfolio = getPortfolio(req.params.id);
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });
  res.json({ data: portfolio });
});

router.put('/:id', (req: Request, res: Response) => {
  const portfolio = updatePortfolio(req.params.id, req.body);
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });
  res.json({ data: portfolio });
});

router.delete('/:id', (req: Request, res: Response) => {
  const deleted = deletePortfolio(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Portfolio not found' });
  res.json({ message: 'Portfolio deleted' });
});

router.get('/:id/control-impact-summary', (req: Request, res: Response) => {
  const summary = getPortfolioControlImpactSummary(req.params.id);
  res.json({ data: summary });
});

export default router;
