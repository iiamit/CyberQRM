import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import helmet from 'helmet';

import scenarioRoutes from './routes/scenarios';
import controlRoutes from './routes/controls';
import portfolioRoutes from './routes/portfolios';
import attackRoutes from './routes/attack';
import { errorHandler } from './middleware/errorHandler';
import { getDb } from './db/database';
import { initAttackService } from './services/attackService';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'] }));
app.use(compression() as any);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// ─── Health ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/controls', controlRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/attack', attackRoutes);

// ─── Error Handler ────────────────────────────────────────────
app.use(errorHandler);

// ─── Init DB, ATT&CK & Start ─────────────────────────────────
getDb(); // initialise schema + run migrations on startup
initAttackService(); // load MITRE ATT&CK data (graceful if absent)
app.listen(PORT, () => {
  console.log(`CyberQRM API running on http://localhost:${PORT}`);
});

export default app;
