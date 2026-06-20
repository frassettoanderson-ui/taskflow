import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Listar grupos (com contagem de empresas)
router.get('/', async (req, res) => {
  const grupos = await prisma.grupoEmpresa.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
    include: { _count: { select: { empresas: true } } },
  });
  return ok(res, grupos.map((g) => ({ id: g.id, nome: g.nome, empresasCount: g._count.empresas })));
});

const upsert = z.object({ nome: z.string().min(1, 'Informe o nome do grupo.') });

router.post('/', requirePermission('empresas_editar'), validate({ body: upsert }), async (req, res) => {
  const g = await prisma.grupoEmpresa.create({
    data: { escritorioId: req.auth!.escritorioId, nome: req.body.nome.trim() },
  });
  return ok(res, g, 201);
});

router.put('/:id', requirePermission('empresas_editar'), validate({ body: upsert }), async (req, res) => {
  const existe = await prisma.grupoEmpresa.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Grupo');
  const g = await prisma.grupoEmpresa.update({ where: { id: existe.id }, data: { nome: req.body.nome.trim() } });
  return ok(res, g);
});

router.delete('/:id', requirePermission('empresas_editar'), async (req, res) => {
  const existe = await prisma.grupoEmpresa.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Grupo');
  await prisma.grupoEmpresa.delete({ where: { id: existe.id } });
  return ok(res, { removido: true });
});

export default router;
