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

// ===== Formularios flexiveis de solicitacao =====
const formGerenciar = requirePermission('portal_solicitacoes');
const campoSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  tipo: z.enum(['texto', 'textarea', 'numero', 'data', 'select']),
  opcoes: z.array(z.string()).optional(),
  obrigatorio: z.boolean().optional(),
});
const formSchema = z.object({
  nome: z.string().min(1, 'Informe o nome.'),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
  campos: z.array(campoSchema).default([]),
});

router.get('/formularios', formGerenciar, async (req, res) => {
  const itens = await prisma.formularioSolicitacao.findMany({ where: { escritorioId: req.auth!.escritorioId }, orderBy: { createdAt: 'desc' } });
  return ok(res, itens);
});
router.post('/formularios', formGerenciar, validate({ body: formSchema }), async (req, res) => {
  const r = await prisma.formularioSolicitacao.create({ data: { escritorioId: req.auth!.escritorioId, ...req.body } });
  return ok(res, r, 201);
});
router.put('/formularios/:id', formGerenciar, validate({ body: formSchema.partial() }), async (req, res) => {
  const f = await prisma.formularioSolicitacao.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!f) throw Errors.naoEncontrado('Formulario');
  const r = await prisma.formularioSolicitacao.update({ where: { id: f.id }, data: req.body });
  return ok(res, r);
});
router.delete('/formularios/:id', formGerenciar, async (req, res) => {
  await prisma.formularioSolicitacao.deleteMany({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  return ok(res, { removido: true });
});

// ===== Avaliacoes das solicitacoes (cliente avaliou ao finalizar) =====
router.get('/avaliacoes-solicitacoes', requirePermission('portal_configurar'), async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const sols = await prisma.solicitacaoPortal.findMany({
    where: { escritorioId, avaliacaoNota: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  const empresaIds = [...new Set(sols.map((s) => s.empresaId))];
  const empresas = await prisma.empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, razaoSocial: true } });
  const empMap = new Map(empresas.map((e) => [e.id, e.razaoSocial]));
  const total = sols.length;
  const media = total ? Math.round((sols.reduce((s, x) => s + (x.avaliacaoNota ?? 0), 0) / total) * 10) / 10 : 0;
  return ok(res, {
    total, media,
    itens: sols.map((s) => ({
      id: s.id, titulo: s.titulo, empresa: empMap.get(s.empresaId) ?? '?', contatoNome: s.contatoNome,
      nota: s.avaliacaoNota, comentario: s.avaliacaoComentario, data: s.updatedAt,
    })),
  });
});

// ===== NPS (painel interno) =====
router.get('/nps', requirePermission('portal_configurar'), async (req, res) => {
  const avaliacoes = await prisma.npsAvaliacao.findMany({ where: { escritorioId: req.auth!.escritorioId }, orderBy: { createdAt: 'desc' }, take: 500 });
  const total = avaliacoes.length;
  const promotores = avaliacoes.filter((a) => a.nota >= 9).length;
  const neutros = avaliacoes.filter((a) => a.nota >= 7 && a.nota <= 8).length;
  const detratores = avaliacoes.filter((a) => a.nota <= 6).length;
  const score = total ? Math.round(((promotores - detratores) / total) * 100) : 0;
  return ok(res, {
    score, total, promotores, neutros, detratores,
    media: total ? Math.round((avaliacoes.reduce((s, a) => s + a.nota, 0) / total) * 10) / 10 : 0,
    avaliacoes: avaliacoes.map((a) => ({ id: a.id, nota: a.nota, comentario: a.comentario, contatoNome: a.contatoNome, contatoEmail: a.contatoEmail, createdAt: a.createdAt })),
  });
});

export default router;
