import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { grupoSchema } from './obrigacao.schemas.js';

// Aceita o payload novo (obrigacoes: [{obrigacaoId, tempoPrevisto}]) ou o legado (obrigacaoIds: string[])
function normalizarItens(body: { obrigacoes?: { obrigacaoId: string; tempoPrevisto?: number }[]; obrigacaoIds?: string[] }) {
  if (body.obrigacoes?.length) return body.obrigacoes.map((o) => ({ obrigacaoId: o.obrigacaoId, tempoPrevisto: o.tempoPrevisto ?? 0 }));
  if (body.obrigacaoIds?.length) return body.obrigacaoIds.map((obrigacaoId) => ({ obrigacaoId, tempoPrevisto: 0 }));
  return [];
}

const router = Router();
router.use(authenticate);
router.use(requirePermission('obrigacoes_ver'));

router.get('/', async (req, res) => {
  const grupos = await prisma.grupoObrigacoes.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
    include: {
      obrigacoes: { include: { obrigacao: { include: { departamento: true } } } },
    },
  });
  return ok(res, grupos);
});

// Um grupo (para a ficha de cadastro)
router.get('/:id', async (req, res) => {
  const g = await prisma.grupoObrigacoes.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    include: { obrigacoes: { include: { obrigacao: { include: { departamento: true } } } } },
  });
  if (!g) throw Errors.naoEncontrado('Grupo');
  return ok(res, g);
});

router.post(
  '/',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: grupoSchema }),
  async (req, res) => {
    const dup = await prisma.grupoObrigacoes.findFirst({
      where: { escritorioId: req.auth!.escritorioId, nome: req.body.nome },
    });
    if (dup) throw Errors.conflito('Ja existe um grupo com esse nome.');
    const itens = normalizarItens(req.body);
    const grupo = await prisma.grupoObrigacoes.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        nome: req.body.nome,
        ativo: req.body.ativo ?? true,
        obrigacoes: itens.length ? { create: itens } : undefined,
      },
    });
    return ok(res, grupo, 201);
  },
);

router.put(
  '/:id',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: grupoSchema.partial() }),
  async (req, res) => {
    const grupo = await prisma.grupoObrigacoes.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!grupo) throw Errors.naoEncontrado('Grupo');
    await prisma.$transaction(async (tx) => {
      await tx.grupoObrigacoes.update({
        where: { id: grupo.id },
        data: { nome: req.body.nome ?? grupo.nome, ativo: req.body.ativo ?? grupo.ativo },
      });
      if (req.body.obrigacoes || req.body.obrigacaoIds) {
        const itens = normalizarItens(req.body);
        await tx.grupoObrigacao.deleteMany({ where: { grupoId: grupo.id } });
        if (itens.length) {
          await tx.grupoObrigacao.createMany({
            data: itens.map((i) => ({ grupoId: grupo.id, ...i })),
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
    const grupo = await prisma.grupoObrigacoes.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!grupo) throw Errors.naoEncontrado('Grupo');
    await prisma.grupoObrigacoes.delete({ where: { id: grupo.id } });
    return ok(res, { removido: true });
  },
);

export default router;
