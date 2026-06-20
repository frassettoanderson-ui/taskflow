import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './dashboard.service.js';

const router = Router();
router.use(authenticate);

// catalogo (metricas + prazos) para os formularios
router.get('/catalogo', (_req, res) => ok(res, { metricas: svc.METRICAS, prazos: svc.PRAZOS }));

// ---------- Indicadores ----------
const indicadorSchema = z.object({
  nome: z.string().min(1, 'Informe o nome.'),
  tipo: z.enum(['numerico', 'colaborador', 'departamento']).default('numerico'),
  metrica: z.string().min(1),
  prazo: z.enum(['mes_atual', 'semana_atual', '7d', '30d']).default('mes_atual'),
  visibilidade: z.enum(['todos', 'somente_meu']).default('todos'),
  ativo: z.boolean().default(true),
  filtroDepartamentoId: z.string().optional().nullable(),
  filtroGrupoId: z.string().optional().nullable(),
  filtroRegimeId: z.string().optional().nullable(),
});

router.get('/indicadores', async (req, res) => {
  const r = await svc.listarIndicadores(req.auth!.escritorioId, req.auth!.id);
  return ok(res, r);
});

router.get('/indicadores/:id/valor', async (req, res) => {
  const ind = await prisma.indicador.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!ind) throw Errors.naoEncontrado('Indicador');
  const r = await svc.calcularIndicador(req.auth!.escritorioId, ind);
  return ok(res, { id: ind.id, nome: ind.nome, tipo: ind.tipo, metrica: ind.metrica, prazo: ind.prazo, ...r });
});

router.post('/indicadores', validate({ body: indicadorSchema }), async (req, res) => {
  const r = await prisma.indicador.create({
    data: { escritorioId: req.auth!.escritorioId, criadoPorId: req.auth!.id, ...req.body,
      filtroDepartamentoId: req.body.filtroDepartamentoId || null, filtroGrupoId: req.body.filtroGrupoId || null, filtroRegimeId: req.body.filtroRegimeId || null },
  });
  return ok(res, r, 201);
});

router.put('/indicadores/:id', validate({ body: indicadorSchema.partial() }), async (req, res) => {
  const ind = await prisma.indicador.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!ind) throw Errors.naoEncontrado('Indicador');
  const r = await prisma.indicador.update({ where: { id: ind.id }, data: req.body });
  return ok(res, r);
});

router.delete('/indicadores/:id', async (req, res) => {
  const ind = await prisma.indicador.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!ind) throw Errors.naoEncontrado('Indicador');
  await prisma.indicador.delete({ where: { id: ind.id } });
  return ok(res, { removido: true });
});

// ---------- Paineis ----------
const painelSchema = z.object({
  nome: z.string().min(1, 'Informe o nome.'),
  transicaoSeg: z.number().int().min(10).max(600).default(60),
  visibilidade: z.enum(['todos', 'somente_meu']).default('todos'),
  ativo: z.boolean().default(true),
  indicadorIds: z.array(z.string()).default([]),
});

router.get('/paineis', async (req, res) => {
  const r = await svc.listarPaineis(req.auth!.escritorioId, req.auth!.id);
  return ok(res, r);
});

router.get('/paineis/:id/calculado', async (req, res) => {
  const r = await svc.painelCalculado(req.auth!.escritorioId, req.auth!.id, req.params.id);
  if (!r) throw Errors.naoEncontrado('Painel');
  return ok(res, r);
});

async function gravarIndicadores(painelId: string, ids: string[]) {
  await prisma.painelIndicador.deleteMany({ where: { painelId } });
  if (ids.length) {
    await prisma.painelIndicador.createMany({ data: ids.map((indicadorId, ordem) => ({ painelId, indicadorId, ordem })) });
  }
}

router.post('/paineis', validate({ body: painelSchema }), async (req, res) => {
  const { indicadorIds, ...dados } = req.body;
  const p = await prisma.painel.create({ data: { escritorioId: req.auth!.escritorioId, criadoPorId: req.auth!.id, ...dados } });
  await gravarIndicadores(p.id, indicadorIds);
  return ok(res, p, 201);
});

router.put('/paineis/:id', validate({ body: painelSchema.partial() }), async (req, res) => {
  const painel = await prisma.painel.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!painel) throw Errors.naoEncontrado('Painel');
  const { indicadorIds, ...dados } = req.body;
  await prisma.painel.update({ where: { id: painel.id }, data: dados });
  if (indicadorIds) await gravarIndicadores(painel.id, indicadorIds);
  return ok(res, { id: painel.id });
});

router.delete('/paineis/:id', async (req, res) => {
  const painel = await prisma.painel.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!painel) throw Errors.naoEncontrado('Painel');
  await prisma.painel.delete({ where: { id: painel.id } });
  return ok(res, { removido: true });
});

// ---------- Painel preferido (exibir ao iniciar) ----------
router.get('/preferido', async (req, res) => {
  const u = await prisma.usuario.findUnique({ where: { id: req.auth!.id }, select: { painelPreferidoId: true } });
  return ok(res, { painelPreferidoId: u?.painelPreferidoId ?? null });
});

router.put('/preferido', validate({ body: z.object({ painelId: z.string().nullable() }) }), async (req, res) => {
  await prisma.usuario.update({ where: { id: req.auth!.id }, data: { painelPreferidoId: req.body.painelId } });
  return ok(res, { painelPreferidoId: req.body.painelId });
});

export default router;
