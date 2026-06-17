import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import escritorioRoutes from './modules/escritorio/escritorio.routes.js';

const api = Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true, data: { status: 'up', ts: new Date().toISOString() } });
});

api.use('/auth', authRoutes);
api.use('/escritorio', escritorioRoutes);

export default api;
