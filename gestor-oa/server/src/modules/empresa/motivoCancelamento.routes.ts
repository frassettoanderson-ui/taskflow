import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

function publico(m: { id: string; nome: string; ativo: boolean; _count?: { empresas: number } }) {
  return { id: m.id, nome: m.nome, ativo: m.ativo, empresasCount: m._count?.empresas ?? 0 };
}

router.get('/', async (req, res) => {
  const itens = await prisma.motivoCancelamento.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
    include: { _count: { select: { empresas: true } } },
  });
  return ok(res, itens.map(publico));
});

router.get('/:id', async (req, res) => {
  const m = await prisma.motivoCancelamento.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    include: { _count: { select: { empresas: true } } },
  });
  if (!m) throw Errors.naoEncontrado('Motivo');
  return ok(res, publico(m));
});

const schema = z.object({ nome: z.string().min(2, 'Nome muito curto.'), ativo: z.boolean().optional() });

router.post('/', requirePermission('empresas_editar'), validate({ body: schema }), async (req, res) => {
  const dup = await prisma.motivoCancelamento.findFirst({ where: { escritorioId: req.auth!.escritorioId, nome: req.body.nome } });
  if (dup) throw Errors.conflito('Ja existe um motivo com esse nome.');
  const m = await prisma.motivoCancelamento.create({
    data: { escritorioId: req.auth!.escritorioId, nome: req.body.nome, ativo: req.body.ativo ?? true },
    include: { _count: { select: { empresas: true } } },
  });
  return ok(res, publico(m), 201);
});

router.put('/:id', requirePermission('empresas_editar'), validate({ body: schema.partial() }), async (req, res) => {
  const m = await prisma.motivoCancelamento.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!m) throw Errors.naoEncontrado('Motivo');
  const atualizado = await prisma.motivoCancelamento.update({
    where: { id: m.id },
    data: { nome: req.body.nome ?? m.nome, ativo: req.body.ativo ?? m.ativo },
    include: { _count: { select: { empresas: true } } },
  });
  return ok(res, publico(atualizado));
});

export default router;
