import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import * as svc from './drive.service.js';

const router = Router();
router.use(authenticate);

// Status da conexao
router.get('/status', async (req, res) => {
  return ok(res, await svc.statusDrive(req.auth!.escritorioId));
});

// URL de autorizacao do Google (o usuario abre, autoriza e cola o codigo)
router.get('/auth-url', requirePermission('admin_escritorio'), async (_req, res) => {
  return ok(res, { url: svc.gerarUrlAuth() });
});

// Conecta colando o codigo (ou a URL de redirecionamento)
router.post('/conectar', requirePermission('admin_escritorio'), validate({ body: z.object({ code: z.string().min(5) }) }), async (req, res) => {
  return ok(res, await svc.conectar(req.auth!.escritorioId, req.body.code));
});

router.post('/desconectar', requirePermission('admin_escritorio'), async (req, res) => {
  await svc.desconectar(req.auth!.escritorioId);
  return ok(res, { ok: true });
});

// Roda o processamento da Entrada agora (alem do polling automatico)
router.post('/processar-agora', requirePermission('entregas_baixar'), async (req, res) => {
  return ok(res, await svc.processarEntrada(req.auth!.escritorioId));
});

export default router;
