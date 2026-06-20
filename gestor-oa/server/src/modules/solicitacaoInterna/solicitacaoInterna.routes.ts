import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { instanciar } from '../processo/processo.service.js';
import { criarNotificacao } from '../../lib/notificar.js';

const router = Router();
router.use(authenticate);

const verPerm = requirePermission('solicitacoes_internas_ver');
const gerenciarPerm = requirePermission('solicitacoes_internas_gerenciar');

const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;
const STATUS = ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDA', 'CANCELADA'] as const;

// Carrega mapa de nomes (usuarios/departamentos/empresas) para enriquecer a resposta.
async function nomes(escritorioId: string) {
  const [usuarios, departamentos, empresas] = await Promise.all([
    prisma.usuario.findMany({ where: { escritorioId, deletedAt: null }, select: { id: true, nome: true } }),
    prisma.departamento.findMany({ where: { escritorioId }, select: { id: true, nome: true } }),
    prisma.empresa.findMany({ where: { escritorioId, deletedAt: null }, select: { id: true, razaoSocial: true } }),
  ]);
  return {
    usuario: new Map(usuarios.map((u) => [u.id, u.nome])),
    departamento: new Map(departamentos.map((d) => [d.id, d.nome])),
    empresa: new Map(empresas.map((e) => [e.id, e.razaoSocial])),
  };
}

function enriquecer(s: Record<string, unknown>, m: Awaited<ReturnType<typeof nomes>>) {
  return {
    ...s,
    solicitanteNome: m.usuario.get(s.solicitanteId as string) ?? null,
    responsavelNome: s.responsavelId ? m.usuario.get(s.responsavelId as string) ?? null : null,
    departamentoDestinoNome: s.departamentoDestinoId ? m.departamento.get(s.departamentoDestinoId as string) ?? null : null,
    empresaNome: s.empresaId ? m.empresa.get(s.empresaId as string) ?? null : null,
  };
}

// ---------- Listagem (com filtros) ----------
router.get('/', verPerm, async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const { status, prioridade, departamentoDestinoId, responsavelId, empresaId, minhas } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { escritorioId };
  if (status) where.status = status;
  if (prioridade) where.prioridade = prioridade;
  if (departamentoDestinoId) where.departamentoDestinoId = departamentoDestinoId;
  if (responsavelId) where.responsavelId = responsavelId;
  if (empresaId) where.empresaId = empresaId;
  if (minhas === 'true') {
    where.OR = [{ responsavelId: req.auth!.id }, { solicitanteId: req.auth!.id }];
  }

  const [itens, mapa] = await Promise.all([
    prisma.solicitacaoInterna.findMany({
      where,
      orderBy: [{ status: 'asc' }, { prioridade: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { mensagens: true } } },
    }),
    nomes(escritorioId),
  ]);
  return ok(res, itens.map((s) => enriquecer(s as never, mapa)));
});

// ---------- Listagem UNIFICADA (internas + externas/portal) ----------
// Espelha a "Gestao de Solicitacoes" do Acessorias: uma tela so, com cadeado
// interna/externa. Os dois modelos seguem separados; aqui apenas mesclamos.
router.get('/unificadas', verPerm, async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const tipoFiltro = (req.query.tipo as string) || ''; // ''|interna|externa
  const verExternas = !!req.auth!.permissoes['portal_solicitacoes'] || !!req.auth!.permissoes['portal_configurar'];

  const mapa = await nomes(escritorioId);
  const out: Record<string, unknown>[] = [];

  if (tipoFiltro !== 'externa') {
    const internas = await prisma.solicitacaoInterna.findMany({ where: { escritorioId }, orderBy: { createdAt: 'desc' } });
    for (const s of internas) out.push({
      id: s.id, tipo: 'interna', titulo: s.titulo, status: s.status, prioridade: s.prioridade,
      empresaNome: s.empresaId ? mapa.empresa.get(s.empresaId) ?? null : null,
      responsavelNome: s.responsavelId ? mapa.usuario.get(s.responsavelId) ?? null : null,
      departamentoNome: s.departamentoDestinoId ? mapa.departamento.get(s.departamentoDestinoId) ?? null : null,
      solicitanteNome: mapa.usuario.get(s.solicitanteId) ?? null,
      avaliacaoNota: null, processoId: s.processoId, prazo: s.prazo, createdAt: s.createdAt,
    });
  }

  if (verExternas && tipoFiltro !== 'interna') {
    const externas = await prisma.solicitacaoPortal.findMany({ where: { escritorioId }, orderBy: { createdAt: 'desc' }, include: { empresa: { select: { razaoSocial: true } } } });
    for (const s of externas) out.push({
      id: s.id, tipo: 'externa', titulo: s.titulo, status: s.status, prioridade: null,
      empresaNome: s.empresa.razaoSocial, responsavelNome: null, departamentoNome: null,
      solicitanteNome: s.contatoNome, avaliacaoNota: s.avaliacaoNota, processoId: null, prazo: s.prazo, createdAt: s.createdAt,
    });
  }

  out.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
  return ok(res, out);
});

// ---------- Estatisticas (cards do topo) ----------
router.get('/stats', verPerm, async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const grupos = await prisma.solicitacaoInterna.groupBy({
    by: ['status'],
    where: { escritorioId },
    _count: true,
  });
  const porStatus: Record<string, number> = {};
  for (const g of grupos) porStatus[g.status] = g._count;
  const atrasadas = await prisma.solicitacaoInterna.count({
    where: { escritorioId, status: { in: ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO'] }, prazo: { lt: new Date() } },
  });
  const minhas = await prisma.solicitacaoInterna.count({
    where: { escritorioId, responsavelId: req.auth!.id, status: { in: ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO'] } },
  });
  return ok(res, { porStatus, atrasadas, minhas });
});

// ---------- Detalhe (com thread) ----------
router.get('/:id', verPerm, async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const s = await prisma.solicitacaoInterna.findFirst({
    where: { id: req.params.id, escritorioId },
    include: { mensagens: { orderBy: { createdAt: 'asc' } } },
  });
  if (!s) throw Errors.naoEncontrado('Solicitacao');
  const mapa = await nomes(escritorioId);
  return ok(res, enriquecer(s as never, mapa));
});

// ---------- Criar ----------
const criarSchema = z.object({
  titulo: z.string().min(2, 'Informe um titulo.'),
  descricao: z.string().min(2, 'Descreva a solicitacao.'),
  categoria: z.string().optional().nullable(),
  prioridade: z.enum(PRIORIDADES).default('MEDIA'),
  departamentoDestinoId: z.string().optional().nullable(),
  responsavelId: z.string().optional().nullable(),
  empresaId: z.string().optional().nullable(),
  prazo: z.string().optional().nullable(),
});

router.post('/', verPerm, validate({ body: criarSchema }), async (req, res) => {
  const b = req.body as z.infer<typeof criarSchema>;
  const s = await prisma.solicitacaoInterna.create({
    data: {
      escritorioId: req.auth!.escritorioId,
      titulo: b.titulo,
      descricao: b.descricao,
      categoria: b.categoria ?? null,
      prioridade: b.prioridade,
      departamentoDestinoId: b.departamentoDestinoId ?? null,
      responsavelId: b.responsavelId ?? null,
      empresaId: b.empresaId ?? null,
      prazo: b.prazo ? new Date(b.prazo) : null,
      solicitanteId: req.auth!.id,
    },
  });
  await prisma.solicitacaoInternaMensagem.create({
    data: { solicitacaoId: s.id, autorId: req.auth!.id, autorNome: req.auth!.nome, texto: 'Solicitacao aberta.', evento: 'ABERTURA' },
  });
  if (s.responsavelId && s.responsavelId !== req.auth!.id) {
    await criarNotificacao({
      escritorioId: req.auth!.escritorioId, usuarioId: s.responsavelId, tipo: 'SOLICITACAO',
      titulo: 'Nova solicitacao atribuida', mensagem: `${req.auth!.nome} atribuiu a voce: "${s.titulo}".`, link: '/solicitacoes-internas',
    });
  }
  return ok(res, s, 201);
});

// ---------- Editar (campos gerenciais) ----------
const editarSchema = criarSchema.partial().extend({
  status: z.enum(STATUS).optional(),
});

router.put('/:id', gerenciarPerm, validate({ body: editarSchema }), async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const existe = await prisma.solicitacaoInterna.findFirst({ where: { id: req.params.id, escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Solicitacao');
  const b = req.body as z.infer<typeof editarSchema>;

  const eventos: string[] = [];
  if (b.responsavelId !== undefined && b.responsavelId !== existe.responsavelId) eventos.push('Responsavel atualizado.');
  if (b.departamentoDestinoId !== undefined && b.departamentoDestinoId !== existe.departamentoDestinoId) eventos.push('Setor de destino atualizado.');
  if (b.prioridade && b.prioridade !== existe.prioridade) eventos.push(`Prioridade alterada para ${b.prioridade}.`);

  const data: Record<string, unknown> = {};
  for (const k of ['titulo', 'descricao', 'categoria', 'prioridade', 'departamentoDestinoId', 'responsavelId', 'empresaId'] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  if (b.prazo !== undefined) data.prazo = b.prazo ? new Date(b.prazo) : null;
  if (b.status) {
    data.status = b.status;
    data.resolvidoEm = b.status === 'RESOLVIDA' ? new Date() : null;
    eventos.push(`Status alterado para ${b.status}.`);
  }

  const s = await prisma.solicitacaoInterna.update({ where: { id: existe.id }, data });
  if (b.responsavelId !== undefined && b.responsavelId && b.responsavelId !== existe.responsavelId && b.responsavelId !== req.auth!.id) {
    await criarNotificacao({
      escritorioId: req.auth!.escritorioId, usuarioId: b.responsavelId, tipo: 'SOLICITACAO',
      titulo: 'Solicitacao atribuida a voce', mensagem: `${req.auth!.nome} atribuiu a voce: "${s.titulo}".`, link: '/solicitacoes-internas',
    });
  }
  for (const ev of eventos) {
    await prisma.solicitacaoInternaMensagem.create({
      data: { solicitacaoId: s.id, autorId: req.auth!.id, autorNome: req.auth!.nome, texto: ev, evento: 'ALTERACAO' },
    });
  }
  return ok(res, s);
});

// ---------- Mudar status (atalho) ----------
router.post('/:id/status', verPerm, validate({ body: z.object({ status: z.enum(STATUS) }) }), async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const existe = await prisma.solicitacaoInterna.findFirst({ where: { id: req.params.id, escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Solicitacao');
  const status = req.body.status as (typeof STATUS)[number];
  const s = await prisma.solicitacaoInterna.update({
    where: { id: existe.id },
    data: { status, resolvidoEm: status === 'RESOLVIDA' ? new Date() : null },
  });
  await prisma.solicitacaoInternaMensagem.create({
    data: { solicitacaoId: s.id, autorId: req.auth!.id, autorNome: req.auth!.nome, texto: `Status alterado para ${status}.`, evento: 'ALTERACAO' },
  });
  return ok(res, s);
});

// ---------- Assumir (atribuir a mim) ----------
router.post('/:id/assumir', verPerm, async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const existe = await prisma.solicitacaoInterna.findFirst({ where: { id: req.params.id, escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Solicitacao');
  const s = await prisma.solicitacaoInterna.update({
    where: { id: existe.id },
    data: { responsavelId: req.auth!.id, status: existe.status === 'ABERTA' ? 'EM_ANDAMENTO' : existe.status },
  });
  await prisma.solicitacaoInternaMensagem.create({
    data: { solicitacaoId: s.id, autorId: req.auth!.id, autorNome: req.auth!.nome, texto: `${req.auth!.nome} assumiu a solicitacao.`, evento: 'ALTERACAO' },
  });
  return ok(res, s);
});

// ---------- Mensagem no thread ----------
router.post('/:id/mensagem', verPerm, validate({ body: z.object({ texto: z.string().min(1) }) }), async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const existe = await prisma.solicitacaoInterna.findFirst({ where: { id: req.params.id, escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Solicitacao');
  const msg = await prisma.solicitacaoInternaMensagem.create({
    data: { solicitacaoId: existe.id, autorId: req.auth!.id, autorNome: req.auth!.nome, texto: req.body.texto },
  });
  if (existe.status === 'ABERTA') {
    await prisma.solicitacaoInterna.update({ where: { id: existe.id }, data: { status: 'EM_ANDAMENTO' } });
  }
  return ok(res, msg, 201);
});

// ---------- Integracao Modulo 6: gerar processo a partir da solicitacao ----------
router.post(
  '/:id/gerar-processo',
  gerenciarPerm,
  validate({ body: z.object({ matrizId: z.string().min(1) }) }),
  async (req, res) => {
    const escritorioId = req.auth!.escritorioId;
    const existe = await prisma.solicitacaoInterna.findFirst({ where: { id: req.params.id, escritorioId } });
    if (!existe) throw Errors.naoEncontrado('Solicitacao');
    if (!existe.empresaId) throw Errors.validacao('Vincule uma empresa antes de gerar o processo.');

    const processo = await instanciar(escritorioId, req.body.matrizId, existe.empresaId);
    const s = await prisma.solicitacaoInterna.update({
      where: { id: existe.id },
      data: { processoId: processo.id, status: existe.status === 'ABERTA' ? 'EM_ANDAMENTO' : existe.status },
    });
    await prisma.solicitacaoInternaMensagem.create({
      data: { solicitacaoId: s.id, autorId: req.auth!.id, autorNome: req.auth!.nome, texto: `Processo gerado a partir desta solicitacao (${processo.nome}).`, evento: 'PROCESSO' },
    });
    return ok(res, { solicitacao: s, processo });
  },
);

// ---------- Excluir ----------
router.delete('/:id', gerenciarPerm, async (req, res) => {
  await prisma.solicitacaoInterna.deleteMany({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  return ok(res, { removido: true });
});

export default router;
