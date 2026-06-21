import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { feriadoSchema } from './obrigacao.schemas.js';

const router = Router();
router.use(authenticate);

// Listar feriados (opcional: ?ano=2026)
router.get('/', async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;
  const where: { escritorioId: string; data?: { gte: Date; lte: Date } } = {
    escritorioId: req.auth!.escritorioId,
  };
  if (ano) where.data = { gte: new Date(ano, 0, 1), lte: new Date(ano, 11, 31) };
  const feriados = await prisma.feriado.findMany({ where, orderBy: { data: 'asc' } });
  return ok(res, feriados);
});

// Um feriado (para a ficha de cadastro)
router.get('/:id', async (req, res) => {
  const f = await prisma.feriado.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
  });
  if (!f) throw Errors.naoEncontrado('Feriado');
  return ok(res, f);
});

router.post(
  '/',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: feriadoSchema }),
  async (req, res) => {
    const feriado = await prisma.feriado.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        data: new Date(req.body.data + 'T00:00:00'),
        nome: req.body.nome,
        abrangencia: req.body.abrangencia,
        uf: req.body.uf || null,
        municipio: req.body.municipio || null,
      },
    });
    return ok(res, feriado, 201);
  },
);

router.put(
  '/:id',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: feriadoSchema.partial() }),
  async (req, res) => {
    const f = await prisma.feriado.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!f) throw Errors.naoEncontrado('Feriado');
    const feriado = await prisma.feriado.update({
      where: { id: f.id },
      data: {
        data: req.body.data ? new Date(req.body.data + 'T00:00:00') : f.data,
        nome: req.body.nome ?? f.nome,
        abrangencia: req.body.abrangencia ?? f.abrangencia,
        uf: req.body.uf !== undefined ? (req.body.uf || null) : f.uf,
        municipio: req.body.municipio !== undefined ? (req.body.municipio || null) : f.municipio,
      },
    });
    return ok(res, feriado);
  },
);

router.delete(
  '/:id',
  requirePermission('obrigacoes_gerenciar'),
  async (req, res) => {
    const f = await prisma.feriado.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!f) throw Errors.naoEncontrado('Feriado');
    await prisma.feriado.delete({ where: { id: f.id } });
    return ok(res, { removido: true });
  },
);

export default router;
