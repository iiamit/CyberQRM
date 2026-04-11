import { Router, Request, Response, NextFunction } from 'express';
import {
  listScenarios,
  getScenario,
  createScenario,
  updateScenario,
  deleteScenario,
  runSimulation,
  getLatestSimulation,
} from '../services/scenarioService';
import { runSensitivityAnalysis } from '../services/simulationEngine';

const router = Router();

const ORG_ID = 'default-org'; // Phase 1: single org

router.get('/', (req: Request, res: Response) => {
  const scenarios = listScenarios(ORG_ID);
  res.json({ data: scenarios });
});

router.post('/', (req: Request, res: Response) => {
  const scenario = createScenario({ ...req.body, organizationId: ORG_ID });
  res.status(201).json({ data: scenario });
});

router.get('/:id', (req: Request, res: Response) => {
  const scenario = getScenario(req.params.id);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  res.json({ data: scenario });
});

router.put('/:id', (req: Request, res: Response) => {
  const scenario = updateScenario(req.params.id, req.body);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  res.json({ data: scenario });
});

router.delete('/:id', (req: Request, res: Response) => {
  const deleted = deleteScenario(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Scenario not found' });
  res.json({ message: 'Scenario deleted' });
});

router.post('/:id/simulate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { result, sensitivity } = runSimulation(req.params.id);
    res.json({ data: { simulation: result, sensitivity } });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('All four')) {
      res.status(400).json({ error: err.message });
    } else {
      next(err);
    }
  }
});

router.get('/:id/results', (req: Request, res: Response) => {
  const result = getLatestSimulation(req.params.id);
  if (!result) return res.status(404).json({ error: 'No simulation results found' });

  // Also return sensitivity if we have all 4 components
  const scenario = getScenario(req.params.id);
  let sensitivity;
  if (scenario?.threatEventFrequency && scenario.vulnerability && scenario.assetValue && scenario.lossEventImpact) {
    try {
      sensitivity = runSensitivityAnalysis(scenario, result.statistics.mean);
    } catch {
      sensitivity = null;
    }
  }

  res.json({ data: { simulation: result, sensitivity } });
});

export default router;
