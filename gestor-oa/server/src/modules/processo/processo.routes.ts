import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import * as svc from './processo.service.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('processos_ver'));

const operar = requirePermission('processos_operar');

router.get('/', async (req, res) => {
  const q = req.query as Record<string, string>;
  const r = await svc.listar(req.auth!.escritorioId, {
    status: q.status, matrizId: q.matrizId, empresaId: q.empresaId, q: q.q,
    statusList: q.statusList ? q.statusList.split(',').filter(Boolean) : undefined,
    inicioDe: q.inicioDe, inicioAte: q.inicioAte, conclusaoDe: q.conclusaoDe, conclusaoAte: q.conclusaoAte,
  });
  return ok(res, r);
});

// Export CSV
router.get('/export', requirePermission('relatorios_ver'), async (req, res) => {
  const r = await svc.listar(req.auth!.escritorioId, {});
  const linhas = ['Processo;Empresa;Status;Progresso;Inicio'];
  for (const p of r) {
    linhas.push([p.nome, p.empresa?.razaoSocial ?? '-', p.status, `${p.progresso}%`, new Date(p.dataInicio).toLocaleDateString('pt-BR')].join(';'));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="processos.csv"');
  return res.send('﻿' + linhas.join('\n'));
});

router.get('/:id', async (req, res) => ok(res, await svc.obter(req.auth!.escritorioId, req.params.id)));

router.post('/iniciar', operar, validate({ body: z.object({
  matrizId: z.string(), empresaId: z.string(),
  titulo: z.string().optional(), observacoes: z.string().optional(), gestorId: z.string().optional(),
}) }), async (req, res) => {
  const p = await svc.instanciar(req.auth!.escritorioId, req.body.matrizId, req.body.empresaId, {
    titulo: req.body.titulo, observacoes: req.body.observacoes, gestorId: req.body.gestorId,
  });
  return ok(res, p, 201);
});

router.put('/:id', operar, validate({ body: z.object({ titulo: z.string().optional(), observacoes: z.string().optional(), gestorId: z.string().optional().nullable() }) }), async (req, res) => {
  return ok(res, await svc.editar(req.auth!.escritorioId, req.params.id, req.body));
});

router.post('/passos/:passoId/concluir', operar, async (req, res) => ok(res, await svc.concluirPasso(req.auth!.escritorioId, req.params.passoId)));
router.post('/passos/:passoId/dispensar', operar, async (req, res) => ok(res, await svc.dispensarPasso(req.auth!.escritorioId, req.params.passoId)));
router.post('/passos/:passoId/reabrir', operar, async (req, res) => ok(res, await svc.reabrirPasso(req.auth!.escritorioId, req.params.passoId)));

// alterna a visibilidade do passo para o cliente (portal)
router.post('/passos/:passoId/visivel-cliente', operar, validate({ body: z.object({ visivel: z.boolean() }) }), async (req, res) => {
  const passo = await prisma.processoPasso.findFirst({ where: { id: req.params.passoId, processo: { escritorioId: req.auth!.escritorioId } } });
  if (!passo) throw new Error('Passo nao encontrado');
  await prisma.processoPasso.update({ where: { id: passo.id }, data: { visivelCliente: req.body.visivel } });
  return ok(res, { visivelCliente: req.body.visivel });
});

router.post('/:id/passos', operar, validate({ body: z.object({ titulo: z.string().min(1), descricao: z.string().optional(), departamentoId: z.string().optional(), bloqueante: z.boolean().optional(), prazoDias: z.number().int().optional() }) }), async (req, res) => {
  return ok(res, await svc.adicionarPasso(req.auth!.escritorioId, req.params.id, req.body));
});

router.post('/:id/comentarios', operar, validate({ body: z.object({ texto: z.string().min(1) }) }), async (req, res) => {
  return ok(res, await svc.comentar(req.auth!.escritorioId, req.params.id, req.body.texto, req.auth!.id));
});

router.post('/:id/suspender', operar, validate({ body: z.object({ dias: z.number().int().min(1) }) }), async (req, res) => {
  return ok(res, await svc.suspender(req.auth!.escritorioId, req.params.id, req.body.dias));
});

router.post('/:id/status', operar, validate({ body: z.object({ status: z.enum(['EM_ANDAMENTO', 'CANCELADO', 'CONCLUIDO']) }) }), async (req, res) => {
  return ok(res, await svc.mudarStatus(req.auth!.escritorioId, req.params.id, req.body.status));
});

router.post('/excluir-massa', requirePermission('processos_gerenciar_matrizes'), validate({ body: z.object({ ids: z.array(z.string()).min(1) }) }), async (req, res) => {
  return ok(res, await svc.excluirMassa(req.auth!.escritorioId, req.body.ids));
});

// ---------- Recorrencia ----------
router.get('/recorrencias/lista', async (req, res) => {
  const itens = await prisma.processoRecorrente.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { createdAt: 'desc' },
    include: { matriz: { select: { nome: true } } },
  });
  return ok(res, itens);
});

router.post(
  '/recorrencias',
  operar,
  validate({
    body: z.object({
      matrizId: z.string(),
      empresaId: z.string().optional().nullable(),
      tipoRecorrencia: z.enum(['DIAS_MES', 'DIAS_SEMANA', 'DIAS_UTEIS']),
      config: z.object({ diasMes: z.array(z.number()).optional(), diasSemana: z.array(z.number()).optional() }).default({}),
      empresaIds: z.array(z.string()).optional(), // configuracao em massa
    }),
  }),
  async (req, res) => {
    const alvos = req.body.empresaIds?.length ? req.body.empresaIds : [req.body.empresaId ?? null];
    let criados = 0;
    for (const empresaId of alvos) {
      await prisma.processoRecorrente.create({
        data: {
          escritorioId: req.auth!.escritorioId, matrizId: req.body.matrizId, empresaId,
          tipoRecorrencia: req.body.tipoRecorrencia, config: req.body.config,
        },
      });
      criados++;
    }
    return ok(res, { criados }, 201);
  },
);

router.delete('/recorrencias/:id', operar, async (req, res) => {
  await prisma.processoRecorrente.deleteMany({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  return ok(res, { removido: true });
});

export default router;
