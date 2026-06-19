import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('processos_ver'));

const passoSchema = z.object({
  ordem: z.number().int(),
  tipo: z.enum(['PASSO_SIMPLES', 'SUB_MATRIZ', 'DESDOBRAMENTO', 'FOLLOW_UP']).default('PASSO_SIMPLES'),
  titulo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  departamentoId: z.string().optional().nullable(),
  prazoDias: z.number().int().min(0).default(0),
  basePrazo: z.enum(['INICIO', 'PASSO_ANTERIOR']).default('INICIO'),
  bloqueante: z.boolean().default(false),
  acaoAutomatica: z.enum(['NENHUMA', 'CRIAR_TAREFA', 'CRIAR_OBRIGACAO_NA_EMPRESA', 'INICIAR_SUBPROCESSO']).default('NENHUMA'),
  acaoRef: z.string().optional().nullable(),
  subMatrizId: z.string().optional().nullable(),
  config: z.any().optional().nullable(),
});
const matrizSchema = z.object({
  nome: z.string().min(2),
  departamentoId: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  soSubmatriz: z.boolean().optional(),
  pedeAutorizacao: z.boolean().optional(),
  barraVermelhaDias: z.number().int().min(0).optional(),
  passos: z.array(passoSchema).optional(),
});

router.get('/', async (req, res) => {
  const matrizes = await prisma.matrizProcesso.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
    include: { passos: { orderBy: { ordem: 'asc' } }, _count: { select: { processos: true } } },
  });
  const emAndamento = await prisma.processo.groupBy({
    by: ['matrizId'],
    where: { escritorioId: req.auth!.escritorioId, status: 'EM_ANDAMENTO' },
    _count: { _all: true },
  });
  const mapaAtivos = new Map(emAndamento.map((g) => [g.matrizId, g._count._all]));
  return ok(res, matrizes.map((m) => ({ ...m, emAndamento: mapaAtivos.get(m.id) ?? 0 })));
});

router.get('/:id', async (req, res) => {
  const m = await prisma.matrizProcesso.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    include: { passos: { orderBy: { ordem: 'asc' } }, _count: { select: { processos: true } } },
  });
  if (!m) throw Errors.naoEncontrado('Matriz');
  return ok(res, m);
});

router.post('/', requirePermission('processos_gerenciar_matrizes'), validate({ body: matrizSchema }), async (req, res) => {
  const m = await prisma.matrizProcesso.create({
    data: {
      escritorioId: req.auth!.escritorioId,
      nome: req.body.nome, departamentoId: req.body.departamentoId || null, descricao: req.body.descricao || null,
      ativo: req.body.ativo ?? true, soSubmatriz: req.body.soSubmatriz ?? false,
      pedeAutorizacao: req.body.pedeAutorizacao ?? false, barraVermelhaDias: req.body.barraVermelhaDias ?? 45,
      passos: { create: req.body.passos ?? [] },
    },
    include: { passos: true },
  });
  return ok(res, m, 201);
});

router.put('/:id', requirePermission('processos_gerenciar_matrizes'), validate({ body: matrizSchema.partial() }), async (req, res) => {
  const existe = await prisma.matrizProcesso.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Matriz');
  await prisma.$transaction(async (tx) => {
    await tx.matrizProcesso.update({
      where: { id: existe.id },
      data: {
        nome: req.body.nome ?? existe.nome,
        departamentoId: req.body.departamentoId ?? existe.departamentoId,
        descricao: req.body.descricao ?? existe.descricao,
        ativo: req.body.ativo ?? existe.ativo,
        soSubmatriz: req.body.soSubmatriz ?? existe.soSubmatriz,
        pedeAutorizacao: req.body.pedeAutorizacao ?? existe.pedeAutorizacao,
        barraVermelhaDias: req.body.barraVermelhaDias ?? existe.barraVermelhaDias,
      },
    });
    if (req.body.passos) {
      await tx.matrizPasso.deleteMany({ where: { matrizId: existe.id } });
      if (req.body.passos.length) await tx.matrizPasso.createMany({ data: req.body.passos.map((p: object) => ({ ...p, matrizId: existe.id })) });
    }
  });
  return ok(res, { atualizado: true });
});

router.delete('/:id', requirePermission('processos_gerenciar_matrizes'), async (req, res) => {
  const existe = await prisma.matrizProcesso.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Matriz');
  await prisma.matrizProcesso.delete({ where: { id: existe.id } });
  return ok(res, { removido: true });
});

export default router;
