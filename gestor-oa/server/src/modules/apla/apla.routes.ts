import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
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

// ---------- Custos fixos (rateados na lucratividade) ----------
const custoFixoSchema = z.object({
  nome: z.string().min(1, 'Informe o nome.'),
  escopo: z.enum(['GERAL', 'GRUPO', 'TAG', 'EMPRESA']).default('GERAL'),
  grupoId: z.string().optional().nullable(),
  tagId: z.string().optional().nullable(),
  empresaId: z.string().optional().nullable(),
  valor: z.number().min(0),
  ativo: z.boolean().default(true),
});

router.get('/custos-fixos', requirePermission('apla_ver'), async (req, res) => {
  const lista = await prisma.custoFixo.findMany({ where: { escritorioId: req.auth!.escritorioId }, orderBy: { createdAt: 'desc' } });
  return ok(res, lista.map((c) => ({ ...c, valor: c.valor.toNumber() })));
});

router.post('/custos-fixos', requirePermission('apla_configurar'), validate({ body: custoFixoSchema }), async (req, res) => {
  const b = req.body;
  const r = await prisma.custoFixo.create({ data: {
    escritorioId: req.auth!.escritorioId, nome: b.nome, escopo: b.escopo, valor: b.valor, ativo: b.ativo,
    grupoId: b.escopo === 'GRUPO' ? b.grupoId || null : null,
    tagId: b.escopo === 'TAG' ? b.tagId || null : null,
    empresaId: b.escopo === 'EMPRESA' ? b.empresaId || null : null,
  } });
  return ok(res, { ...r, valor: r.valor.toNumber() }, 201);
});

router.put('/custos-fixos/:id', requirePermission('apla_configurar'), validate({ body: custoFixoSchema.partial() }), async (req, res) => {
  const cf = await prisma.custoFixo.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!cf) throw Errors.naoEncontrado('Custo fixo');
  const r = await prisma.custoFixo.update({ where: { id: cf.id }, data: req.body });
  return ok(res, { ...r, valor: r.valor.toNumber() });
});

router.delete('/custos-fixos/:id', requirePermission('apla_configurar'), async (req, res) => {
  const cf = await prisma.custoFixo.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!cf) throw Errors.naoEncontrado('Custo fixo');
  await prisma.custoFixo.delete({ where: { id: cf.id } });
  return ok(res, { removido: true });
});

export default router;
