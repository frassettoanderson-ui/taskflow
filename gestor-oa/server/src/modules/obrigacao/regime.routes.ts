import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { regimeSchema } from './obrigacao.schemas.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('obrigacoes_ver'));

router.get('/', async (req, res) => {
  const regimes = await prisma.regimeTributario.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
    include: {
      obrigacoes: { include: { obrigacao: { include: { departamento: true } } } },
      _count: { select: { empresas: true } },
    },
  });
  return ok(res, regimes);
});

// Relatorio: empresas por regime (todas ou de um regime especifico)
router.get('/relatorio/empresas', async (req, res) => {
  const regimeId = typeof req.query.regimeId === 'string' && req.query.regimeId ? req.query.regimeId : undefined;
  const empresas = await prisma.empresa.findMany({
    where: {
      escritorioId: req.auth!.escritorioId,
      deletedAt: null,
      regimeTributarioId: regimeId ?? { not: null },
    },
    orderBy: [{ razaoSocial: 'asc' }],
    include: { regimeTributario: true, identificadores: true },
  });
  const linhas = empresas.map((e) => ({
    regime: e.regimeTributario?.nome ?? '—',
    razaoSocial: e.razaoSocial,
    cnpj: e.identificadores.find((i) => i.tipo === 'CNPJ')?.valor ?? '',
    fone: e.telefone ?? '',
  }));
  return ok(res, linhas);
});

router.post(
  '/',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: regimeSchema }),
  async (req, res) => {
    const dup = await prisma.regimeTributario.findFirst({
      where: { escritorioId: req.auth!.escritorioId, nome: req.body.nome },
    });
    if (dup) throw Errors.conflito('Ja existe um regime com esse nome.');
    const regime = await prisma.regimeTributario.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        nome: req.body.nome,
        ativo: req.body.ativo ?? true,
        obrigacoes: req.body.obrigacoes?.length
          ? {
              create: req.body.obrigacoes.map((o: { obrigacaoId: string; tempoPrevistoOverride?: number | null }) => ({
                obrigacaoId: o.obrigacaoId,
                tempoPrevistoOverride: o.tempoPrevistoOverride ?? null,
              })),
            }
          : undefined,
      },
    });
    return ok(res, regime, 201);
  },
);

router.put(
  '/:id',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: regimeSchema.partial() }),
  async (req, res) => {
    const regime = await prisma.regimeTributario.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!regime) throw Errors.naoEncontrado('Regime');

    await prisma.$transaction(async (tx) => {
      await tx.regimeTributario.update({
        where: { id: regime.id },
        data: {
          nome: req.body.nome ?? regime.nome,
          ativo: req.body.ativo ?? regime.ativo,
        },
      });
      // se a lista de obrigacoes veio, substitui o conjunto
      if (req.body.obrigacoes) {
        await tx.regimeObrigacao.deleteMany({ where: { regimeId: regime.id } });
        if (req.body.obrigacoes.length) {
          await tx.regimeObrigacao.createMany({
            data: req.body.obrigacoes.map((o: { obrigacaoId: string; tempoPrevistoOverride?: number | null }) => ({
              regimeId: regime.id,
              obrigacaoId: o.obrigacaoId,
              tempoPrevistoOverride: o.tempoPrevistoOverride ?? null,
            })),
          });
        }
      }
    });
    return ok(res, { atualizado: true });
  },
);

router.delete(
  '/:id',
  requirePermission('obrigacoes_gerenciar'),
  async (req, res) => {
    const regime = await prisma.regimeTributario.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
      include: { _count: { select: { empresas: true } } },
    });
    if (!regime) throw Errors.naoEncontrado('Regime');
    if (regime._count.empresas > 0) {
      throw Errors.conflito('Ha empresas usando este regime. Reatribua antes de excluir.');
    }
    await prisma.regimeTributario.delete({ where: { id: regime.id } });
    return ok(res, { removido: true });
  },
);

export default router;
