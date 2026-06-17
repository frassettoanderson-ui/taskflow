import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Listagem basica de usuarios do escritorio (para seletores).
// O Modulo 4 adiciona CRUD completo, permissoes e filtros.
router.get('/', async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    where: { escritorioId: req.auth!.escritorioId, deletedAt: null },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, email: true, ativo: true },
  });
  return ok(res, usuarios);
});

export default router;
