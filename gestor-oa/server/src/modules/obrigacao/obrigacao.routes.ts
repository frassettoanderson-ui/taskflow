import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { obrigacaoSchema } from './obrigacao.schemas.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('obrigacoes_ver'));

// Listar catalogo (filtros: departamentoId, busca, ativo)
router.get('/', async (req, res) => {
  const { departamentoId, busca } = req.query as Record<string, string>;
  const obrigacoes = await prisma.obrigacao.findMany({
    where: {
      escritorioId: req.auth!.escritorioId,
      deletedAt: null,
      ...(departamentoId ? { departamentoId } : {}),
      ...(busca ? { nome: { contains: busca, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ nome: 'asc' }],
    include: {
      departamento: { select: { id: true, nome: true, cor: true } },
      _count: { select: { empresaObrigacoes: true } },
    },
  });
  return ok(res, obrigacoes);
});

// Exportar catalogo por regime em CSV (relacao de obrigacoes por regime)
router.get('/export', requirePermission('relatorios_ver'), async (req, res) => {
  const regimes = await prisma.regimeTributario.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    include: {
      obrigacoes: {
        include: { obrigacao: { include: { departamento: true } } },
      },
    },
    orderBy: { nome: 'asc' },
  });

  const linhas: string[] = ['Regime;Departamento;Obrigacao;Periodicidade;Tempo previsto (min)'];
  for (const r of regimes) {
    for (const ro of r.obrigacoes) {
      const o = ro.obrigacao;
      linhas.push(
        [
          r.nome,
          o.departamento?.nome ?? '-',
          o.nome,
          o.periodicidade,
          String(ro.tempoPrevistoOverride ?? o.tempoPrevistoMin),
        ].join(';'),
      );
    }
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="obrigacoes_por_regime.csv"');
  return res.send('﻿' + linhas.join('\n'));
});

router.post(
  '/',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: obrigacaoSchema }),
  async (req, res) => {
    const o = await prisma.obrigacao.create({
      data: { escritorioId: req.auth!.escritorioId, ...req.body },
      include: { departamento: true },
    });
    return ok(res, o, 201);
  },
);

router.put(
  '/:id',
  requirePermission('obrigacoes_gerenciar'),
  validate({ body: obrigacaoSchema.partial() }),
  async (req, res) => {
    const existe = await prisma.obrigacao.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId, deletedAt: null },
    });
    if (!existe) throw Errors.naoEncontrado('Obrigacao');
    const o = await prisma.obrigacao.update({
      where: { id: req.params.id },
      data: req.body,
      include: { departamento: true },
    });
    return ok(res, o);
  },
);

router.delete(
  '/:id',
  requirePermission('obrigacoes_gerenciar'),
  async (req, res) => {
    const existe = await prisma.obrigacao.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId, deletedAt: null },
    });
    if (!existe) throw Errors.naoEncontrado('Obrigacao');
    await prisma.obrigacao.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), ativo: false },
    });
    return ok(res, { excluida: true });
  },
);

export default router;
