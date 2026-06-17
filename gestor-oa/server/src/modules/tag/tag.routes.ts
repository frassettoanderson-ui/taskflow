import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const itens = await prisma.tag.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
    include: { _count: { select: { empresas: true } } },
  });
  return ok(
    res,
    itens.map((t) => ({
      id: t.id,
      nome: t.nome,
      cor: t.cor,
      qtdEmpresas: t._count.empresas,
    })),
  );
});

const upsertSchema = z.object({
  nome: z.string().min(1, 'Informe o nome da tag.'),
  cor: z.string().optional(),
});

router.post(
  '/',
  requirePermission('empresas_editar'),
  validate({ body: upsertSchema }),
  async (req, res) => {
    const existe = await prisma.tag.findFirst({
      where: { escritorioId: req.auth!.escritorioId, nome: req.body.nome },
    });
    if (existe) throw Errors.conflito('Ja existe uma tag com esse nome.');
    const tag = await prisma.tag.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        nome: req.body.nome,
        cor: req.body.cor ?? '#64748b',
      },
    });
    return ok(res, tag, 201);
  },
);

router.delete(
  '/:id',
  requirePermission('empresas_editar'),
  async (req, res) => {
    const tag = await prisma.tag.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!tag) throw Errors.naoEncontrado('Tag');
    await prisma.tag.delete({ where: { id: tag.id } });
    return ok(res, { removida: true });
  },
);

export default router;
