import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { JOBS, JOBS_INFO, executarJob, type JobNome } from './jobs.service.js';

const router = Router();
router.use(authenticate);

// ---------- Notificacoes do usuario logado ----------
router.get('/', async (req, res) => {
  const apenasNaoLidas = req.query.naoLidas === 'true';
  const itens = await prisma.notificacao.findMany({
    where: { usuarioId: req.auth!.id, ...(apenasNaoLidas ? { lida: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const naoLidas = await prisma.notificacao.count({ where: { usuarioId: req.auth!.id, lida: false } });
  return ok(res, { itens, naoLidas });
});

router.get('/contagem', async (req, res) => {
  const naoLidas = await prisma.notificacao.count({ where: { usuarioId: req.auth!.id, lida: false } });
  return ok(res, { naoLidas });
});

router.post('/:id/ler', async (req, res) => {
  const n = await prisma.notificacao.findFirst({ where: { id: req.params.id, usuarioId: req.auth!.id } });
  if (!n) throw Errors.naoEncontrado('Notificacao');
  await prisma.notificacao.update({ where: { id: n.id }, data: { lida: true, lidaEm: new Date() } });
  return ok(res, { ok: true });
});

router.post('/ler-todas', async (req, res) => {
  await prisma.notificacao.updateMany({ where: { usuarioId: req.auth!.id, lida: false }, data: { lida: true, lidaEm: new Date() } });
  return ok(res, { ok: true });
});

router.delete('/:id', async (req, res) => {
  await prisma.notificacao.deleteMany({ where: { id: req.params.id, usuarioId: req.auth!.id } });
  return ok(res, { removido: true });
});

// ---------- Administracao de Jobs (scheduler) ----------
const adminJobs = requirePermission('admin_escritorio');

router.get('/jobs/lista', adminJobs, async (_req, res) => {
  const execucoes = await prisma.jobExecucao.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  return ok(res, {
    jobs: JOBS.map((j) => ({ nome: j, descricao: JOBS_INFO[j] })),
    execucoes,
  });
});

router.post('/jobs/executar', adminJobs, validate({ body: z.object({ nome: z.enum(JOBS as unknown as [string, ...string[]]) }) }), async (req, res) => {
  const r = await executarJob(req.body.nome as JobNome);
  return ok(res, r);
});

export default router;
