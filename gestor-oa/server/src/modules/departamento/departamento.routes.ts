import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Listar departamentos do escritorio
router.get('/', async (req, res) => {
  const itens = await prisma.departamento.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
  });
  return ok(res, itens);
});

const upsertSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto.'),
  cor: z.string().optional(),
  responsavelId: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.post(
  '/',
  requirePermission('admin_escritorio'),
  validate({ body: upsertSchema }),
  async (req, res) => {
    const existe = await prisma.departamento.findFirst({
      where: { escritorioId: req.auth!.escritorioId, nome: req.body.nome },
    });
    if (existe) throw Errors.conflito('Ja existe um departamento com esse nome.');
    const dep = await prisma.departamento.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        nome: req.body.nome,
        cor: req.body.cor ?? '#0f5c5e',
        responsavelId: req.body.responsavelId ?? null,
        ativo: req.body.ativo ?? true,
      },
    });
    return ok(res, dep, 201);
  },
);

router.put(
  '/:id',
  requirePermission('admin_escritorio'),
  validate({ body: upsertSchema.partial() }),
  async (req, res) => {
    const dep = await prisma.departamento.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!dep) throw Errors.naoEncontrado('Departamento');
    const atualizado = await prisma.departamento.update({
      where: { id: dep.id },
      data: {
        nome: req.body.nome ?? dep.nome,
        cor: req.body.cor ?? dep.cor,
        responsavelId: req.body.responsavelId === undefined ? dep.responsavelId : req.body.responsavelId,
        ativo: req.body.ativo ?? dep.ativo,
      },
    });
    return ok(res, atualizado);
  },
);

export default router;
