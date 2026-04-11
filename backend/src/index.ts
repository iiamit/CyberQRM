import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import helmet from 'helmet';

import scenarioRoutes from './routes/scenarios';
import controlRoutes from './routes/controls';
import portfolioRoutes from './routes/portfolios';
import { errorHandler } from './middleware/errorHandler';
import { getDb } from './db/database';

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

// ─── Error Handler ────────────────────────────────────────────
app.use(errorHandler);

// ─── Init DB & Start ──────────────────────────────────────────
getDb(); // initialise schema on startup
app.listen(PORT, () => {
  console.log(`CyberQRM API running on http://localhost:${PORT}`);
});

export default app;
