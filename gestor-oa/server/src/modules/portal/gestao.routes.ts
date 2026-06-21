import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { hashPassword } from '../../lib/password.js';

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
    take: 5000,
  });
  const empresaIds = [...new Set(sols.map((s) => s.empresaId))];
  const empresas = await prisma.empresa.findMany({ where: { id: { in: empresaIds }, escritorioId }, select: { id: true, razaoSocial: true } });
  const nomeEmp = new Map(empresas.map((e) => [e.id, e.razaoSocial]));

  // escala 1-5: promotor >=4, neutro =3, detrator <=2
  type Contato = { nome: string; avaliacoes: number; soma: number; ultima: Date };
  type Grupo = { id: string; nome: string; detr: number; neut: number; prom: number; total: number; soma: number; contatos: Map<string, Contato> };
  const grupos = new Map<string, Grupo>();
  for (const s of sols) {
    const nota = s.avaliacaoNota ?? 0;
    const empId = s.empresaId;
    const g = grupos.get(empId) ?? { id: empId, nome: nomeEmp.get(empId) ?? 'Sem empresa', detr: 0, neut: 0, prom: 0, total: 0, soma: 0, contatos: new Map() };
    if (nota >= 4) g.prom++; else if (nota === 3) g.neut++; else g.detr++;
    g.total++; g.soma += nota;
    const key = s.contatoNome || s.id;
    const ct = g.contatos.get(key) ?? { nome: s.contatoNome || 'Contato', avaliacoes: 0, soma: 0, ultima: s.updatedAt };
    ct.avaliacoes++; ct.soma += nota; if (s.updatedAt > ct.ultima) ct.ultima = s.updatedAt;
    g.contatos.set(key, ct);
    grupos.set(empId, g);
  }

  const empresasOut = [...grupos.values()].map((g) => ({
    id: g.id, nome: g.nome,
    detratores: g.detr, neutros: g.neut, promotores: g.prom, avaliacoes: g.total,
    media: g.total ? Math.round((g.soma / g.total) * 10) / 10 : 0,
    contatos: [...g.contatos.values()].map((c) => ({ nome: c.nome, avaliacoes: c.avaliacoes, media: c.avaliacoes ? Math.round((c.soma / c.avaliacoes) * 10) / 10 : 0, ultima: c.ultima }))
      .sort((a, b) => b.ultima.getTime() - a.ultima.getTime()),
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const tot = empresasOut.length;
  const prom = empresasOut.filter((e) => e.media >= 4).length;
  const neut = empresasOut.filter((e) => e.media >= 3 && e.media < 4).length;
  const detr = empresasOut.filter((e) => e.media > 0 && e.media < 3).length;
  const pct = (n: number) => tot ? Math.round((n / tot) * 10000) / 100 : 0;
  const cards = { detratoras: pct(detr), neutras: pct(neut), promotoras: pct(prom), nps: tot ? Math.round(((prom - detr) / tot) * 100) : 0 };

  return ok(res, { cards, empresas: empresasOut });
});

// ===== Usuarios do APP (contatos com acesso ao portal) =====
const appPerm = requirePermission('portal_configurar');

router.get('/usuarios-app', appPerm, async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const contatos = await prisma.empresaContato.findMany({
    where: { escritorioId, email: { not: null } },
    select: { id: true, nome: true, email: true, ativo: true, senhaHash: true, empresa: { select: { razaoSocial: true } } },
    orderBy: { nome: 'asc' },
  });
  return ok(res, contatos.map((c) => ({
    id: c.id, nome: c.nome, email: c.email, empresa: c.empresa.razaoSocial,
    ativo: c.ativo, temAcesso: !!c.senhaHash,
  })));
});

router.post('/usuarios-app/ativar-massa', appPerm, async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const senhaHash = await hashPassword('123');
  const r = await prisma.empresaContato.updateMany({
    where: { escritorioId, email: { not: null }, senhaHash: null, ativo: true },
    data: { senhaHash },
  });
  return ok(res, { ativados: r.count, senha: '123' });
});

router.post('/usuarios-app/:id/ativar', appPerm, async (req, res) => {
  const c = await prisma.empresaContato.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!c) throw Errors.naoEncontrado('Contato');
  if (!c.email) throw Errors.validacao('Contato sem e-mail.');
  await prisma.empresaContato.update({ where: { id: c.id }, data: { senhaHash: await hashPassword('123'), ativo: true } });
  return ok(res, { ativado: true, email: c.email, senha: '123' });
});

// ===== NPS (painel interno) =====
router.get('/nps', requirePermission('portal_configurar'), async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const avaliacoes = await prisma.npsAvaliacao.findMany({ where: { escritorioId }, orderBy: { createdAt: 'desc' }, take: 5000 });
  const empIds = [...new Set(avaliacoes.map((a) => a.empresaId).filter(Boolean))] as string[];
  const emps = await prisma.empresa.findMany({ where: { id: { in: empIds }, escritorioId }, select: { id: true, razaoSocial: true } });
  const nomeEmp = new Map(emps.map((e) => [e.id, e.razaoSocial]));

  type Contato = { nome: string; avaliacoes: number; soma: number; ultima: Date };
  type Grupo = { id: string; nome: string; detr: number; neut: number; prom: number; total: number; soma: number; contatos: Map<string, Contato> };
  const grupos = new Map<string, Grupo>();
  for (const a of avaliacoes) {
    const empId = a.empresaId ?? 'sem';
    const g = grupos.get(empId) ?? { id: empId, nome: nomeEmp.get(empId) ?? 'Sem empresa', detr: 0, neut: 0, prom: 0, total: 0, soma: 0, contatos: new Map() };
    if (a.nota >= 9) g.prom++; else if (a.nota >= 7) g.neut++; else g.detr++;
    g.total++; g.soma += a.nota;
    const key = a.contatoEmail || a.contatoNome || 'anon';
    const ct = g.contatos.get(key) ?? { nome: a.contatoNome || a.contatoEmail || 'Contato', avaliacoes: 0, soma: 0, ultima: a.createdAt };
    ct.avaliacoes++; ct.soma += a.nota; if (a.createdAt > ct.ultima) ct.ultima = a.createdAt;
    g.contatos.set(key, ct);
    grupos.set(empId, g);
  }

  const empresas = [...grupos.values()].map((g) => ({
    id: g.id, nome: g.nome,
    detratores: g.detr, neutros: g.neut, promotores: g.prom, avaliacoes: g.total,
    media: g.total ? Math.round((g.soma / g.total) * 10) / 10 : 0,
    contatos: [...g.contatos.values()].map((c) => ({ nome: c.nome, avaliacoes: c.avaliacoes, media: c.avaliacoes ? Math.round((c.soma / c.avaliacoes) * 10) / 10 : 0, ultima: c.ultima }))
      .sort((a, b) => b.ultima.getTime() - a.ultima.getTime()),
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // Cards: cada EMPRESA classificada pela sua media (>=9 promotora, 7-8 neutra, <7 detratora)
  const tot = empresas.length;
  const prom = empresas.filter((e) => e.media >= 9).length;
  const neut = empresas.filter((e) => e.media >= 7 && e.media < 9).length;
  const detr = empresas.filter((e) => e.media > 0 && e.media < 7).length;
  const pct = (n: number) => tot ? Math.round((n / tot) * 10000) / 100 : 0;
  const cards = { detratoras: pct(detr), neutras: pct(neut), promotoras: pct(prom), nps: tot ? Math.round(((prom - detr) / tot) * 100) : 0 };

  return ok(res, { cards, empresas });
});

export default router;
