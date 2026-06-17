import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import escritorioRoutes from './modules/escritorio/escritorio.routes.js';
import usuarioRoutes from './modules/usuario/usuario.routes.js';
import departamentoRoutes from './modules/departamento/departamento.routes.js';
import tagRoutes from './modules/tag/tag.routes.js';
import empresaRoutes from './modules/empresa/empresa.routes.js';
import insightsRoutes from './modules/insights/insights.routes.js';

const api = Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true, data: { status: 'up', ts: new Date().toISOString() } });
});

api.use('/auth', authRoutes);
api.use('/escritorio', escritorioRoutes);
api.use('/usuarios', usuarioRoutes);
api.use('/departamentos', departamentoRoutes);
api.use('/tags', tagRoutes);
api.use('/empresas', empresaRoutes);
api.use('/insights', insightsRoutes);

export default api;
