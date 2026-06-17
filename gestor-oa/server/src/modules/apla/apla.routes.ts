import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { computarApla, lerAplaConfig } from './apla.service.js';

const router = Router();
router.use(authenticate);

// ---------- Relatorio APLA ----------
router.get('/relatorio', requirePermission('apla_ver'), async (req, res) => {
  const hoje = new Date();
  const ano = Number(req.query.ano) || hoje.getFullYear();
  const mes = Number(req.query.mes) || hoje.getMonth() + 1;
  const dados = await computarApla(req.auth!.escritorioId, ano, mes);
  return ok(res, dados);
});

// ---------- Configuracao (custo/hora) ----------
router.get('/config', requirePermission('apla_ver'), async (req, res) => {
  const e = await prisma.escritorio.findUniqueOrThrow({ where: { id: req.auth!.escritorioId } });
  return ok(res, lerAplaConfig(e.config));
});

router.put('/config', requirePermission('apla_configurar'), validate({ body: z.object({ custoHora: z.number().min(0) }) }), async (req, res) => {
  const e = await prisma.escritorio.findUniqueOrThrow({ where: { id: req.auth!.escritorioId } });
  const config = { ...(e.config as object), apla: { custoHora: req.body.custoHora } };
  await prisma.escritorio.update({ where: { id: e.id }, data: { config } });
  return ok(res, lerAplaConfig(config));
});

export default router;
