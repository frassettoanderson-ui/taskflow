import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { grupoSchema } from './obrigacao.schemas.js';

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

router.post(
  '/',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: grupoSchema }),
  async (req, res) => {
    const dup = await prisma.grupoObrigacoes.findFirst({
      where: { escritorioId: req.auth!.escritorioId, nome: req.body.nome },
    });
    if (dup) throw Errors.conflito('Ja existe um grupo com esse nome.');
    const grupo = await prisma.grupoObrigacoes.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        nome: req.body.nome,
        ativo: req.body.ativo ?? true,
        obrigacoes: req.body.obrigacaoIds?.length
          ? { create: req.body.obrigacaoIds.map((obrigacaoId: string) => ({ obrigacaoId })) }
          : undefined,
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
      if (req.body.obrigacaoIds) {
        await tx.grupoObrigacao.deleteMany({ where: { grupoId: grupo.id } });
        if (req.body.obrigacaoIds.length) {
          await tx.grupoObrigacao.createMany({
            data: req.body.obrigacaoIds.map((obrigacaoId: string) => ({ grupoId: grupo.id, obrigacaoId })),
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
