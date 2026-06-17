import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ===== Comunicados (gestao) =====
const comGerenciar = requirePermission('portal_comunicados');

router.get('/comunicados', comGerenciar, async (req, res) => {
  const itens = await prisma.comunicado.findMany({ where: { escritorioId: req.auth!.escritorioId }, orderBy: { createdAt: 'desc' } });
  return ok(res, itens);
});

const comSchema = z.object({
  titulo: z.string().min(2),
  conteudo: z.string().min(2),
  tags: z.array(z.string()).default([]),
  regimes: z.array(z.string()).default([]),
  publicarEm: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.post('/comunicados', comGerenciar, validate({ body: comSchema }), async (req, res) => {
  const c = await prisma.comunicado.create({
    data: {
      escritorioId: req.auth!.escritorioId, titulo: req.body.titulo, conteudo: req.body.conteudo,
      tags: req.body.tags, regimes: req.body.regimes,
      publicarEm: req.body.publicarEm ? new Date(req.body.publicarEm) : null,
    },
  });
  return ok(res, c, 201);
});

router.put('/comunicados/:id', comGerenciar, validate({ body: comSchema.partial() }), async (req, res) => {
  const existe = await prisma.comunicado.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Comunicado');
  const c = await prisma.comunicado.update({ where: { id: req.params.id }, data: { ...req.body, publicarEm: req.body.publicarEm ? new Date(req.body.publicarEm) : existe.publicarEm } });
  return ok(res, c);
});

router.delete('/comunicados/:id', comGerenciar, async (req, res) => {
  await prisma.comunicado.deleteMany({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  return ok(res, { removido: true });
});

// ===== Solicitacoes (inbox interno) =====
const solGerenciar = requirePermission('portal_solicitacoes');

router.get('/solicitacoes', solGerenciar, async (req, res) => {
  const status = req.query.status as string | undefined;
  const itens = await prisma.solicitacaoPortal.findMany({
    where: { escritorioId: req.auth!.escritorioId, ...(status ? { status: status as never } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { empresa: { select: { razaoSocial: true } } },
  });
  return ok(res, itens);
});

router.get('/solicitacoes/:id', solGerenciar, async (req, res) => {
  const s = await prisma.solicitacaoPortal.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    include: { mensagens: { orderBy: { createdAt: 'asc' } }, empresa: { select: { razaoSocial: true } } },
  });
  if (!s) throw Errors.naoEncontrado('Solicitacao');
  return ok(res, s);
});

router.post('/solicitacoes/:id/mensagem', solGerenciar, validate({ body: z.object({ texto: z.string().min(1) }) }), async (req, res) => {
  const s = await prisma.solicitacaoPortal.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!s) throw Errors.naoEncontrado('Solicitacao');
  await prisma.solicitacaoMensagem.create({ data: { solicitacaoId: s.id, autorTipo: 'USUARIO', autorNome: req.auth!.nome, texto: req.body.texto } });
  if (s.status === 'ABERTA') await prisma.solicitacaoPortal.update({ where: { id: s.id }, data: { status: 'EM_ANDAMENTO' } });
  return ok(res, { enviado: true });
});

router.post('/solicitacoes/:id/status', solGerenciar, validate({ body: z.object({ status: z.enum(['ABERTA', 'EM_ANDAMENTO', 'FINALIZADA']) }) }), async (req, res) => {
  const s = await prisma.solicitacaoPortal.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!s) throw Errors.naoEncontrado('Solicitacao');
  await prisma.solicitacaoPortal.update({ where: { id: s.id }, data: { status: req.body.status } });
  return ok(res, { ok: true });
});

export default router;
