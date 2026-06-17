import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { ok, parsePagination, paginated } from '../../lib/http.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('admin_auditoria'));

// Timeline de auditoria filtravel (usuario, entidade, periodo).
router.get('/', async (req, res) => {
  const pag = parsePagination(req.query);
  const q = req.query as Record<string, string>;

  const where: Prisma.LogAuditoriaWhereInput = { escritorioId: req.auth!.escritorioId };
  if (q.usuarioId) where.usuarioId = q.usuarioId;
  if (q.entidade) where.entidade = q.entidade;
  if (q.acao) where.acao = q.acao;
  if (q.de || q.ate) {
    where.createdAt = {};
    if (q.de) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.de + 'T00:00:00');
    if (q.ate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.ate + 'T23:59:59');
  }

  const [items, total] = await Promise.all([
    prisma.logAuditoria.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pag.skip,
      take: pag.take,
      include: { usuario: { select: { nome: true } } },
    }),
    prisma.logAuditoria.count({ where }),
  ]);

  return ok(res, paginated(items, total, pag));
});

// Lista de entidades distintas (para o filtro)
router.get('/entidades', async (req, res) => {
  const grupos = await prisma.logAuditoria.groupBy({
    by: ['entidade'],
    where: { escritorioId: req.auth!.escritorioId },
  });
  return ok(res, grupos.map((g) => g.entidade).sort());
});

export default router;
