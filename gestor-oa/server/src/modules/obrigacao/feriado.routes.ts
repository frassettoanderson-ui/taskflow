import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { feriadoSchema } from './obrigacao.schemas.js';

const router = Router();
router.use(authenticate);

// data concreta a partir de dia/mes/ano (ano=0 => recorrente => null)
function dataDe(dia: number, mes: number, ano: number): Date | null {
  return ano && ano > 0 ? new Date(ano, mes - 1, dia) : null;
}

// Listar feriados
router.get('/', async (req, res) => {
  const feriados = await prisma.feriado.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: [{ ano: 'asc' }, { mes: 'asc' }, { dia: 'asc' }],
  });
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
    const { dia, mes, ano = 0, nome, cidades } = req.body;
    const feriado = await prisma.feriado.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        dia, mes, ano,
        data: dataDe(dia, mes, ano),
        nome,
        cidades: cidades || null,
        abrangencia: cidades?.trim() ? 'MUNICIPAL' : 'NACIONAL',
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
    const dia = req.body.dia ?? f.dia;
    const mes = req.body.mes ?? f.mes;
    const ano = req.body.ano ?? f.ano;
    const cidades = req.body.cidades !== undefined ? (req.body.cidades || null) : f.cidades;
    const feriado = await prisma.feriado.update({
      where: { id: f.id },
      data: {
        dia, mes, ano,
        data: dataDe(dia, mes, ano),
        nome: req.body.nome ?? f.nome,
        cidades,
        abrangencia: cidades?.trim() ? 'MUNICIPAL' : 'NACIONAL',
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
