import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { ensureDir, STORAGE_ROOT } from '../../lib/storage.js';
import { generateToken } from '../../lib/password.js';
import { requestContext } from '../../context.js';
import * as svc from './robo.service.js';

const router = Router();

const uploadRobo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureDir(path.join(STORAGE_ROOT, 'robo', 'entrada'))),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Consulta documento: arquivos em memoria (dry-run, nao persiste)
const uploadConsulta = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 30 } });

// ---------- INGEST por API key (sem JWT) ----------
// Integracoes externas empurram guias: POST /api/v1/robo/ingest  (header x-api-key)
router.post('/ingest', uploadRobo.array('arquivos', 50), async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) throw Errors.naoAutenticado();
    const escritorios = await prisma.escritorio.findMany({ where: { deletedAt: null } });
    const esc = escritorios.find((e) => (e.config as Record<string, unknown>).roboApiKey === apiKey);
    if (!esc) throw Errors.naoAutenticado();

    const files = (req.files as Express.Multer.File[]) ?? [];
    const todos = [];
    for (const f of files) {
      // executa dentro do contexto do tenant para auditoria
      const r = await requestContext.run({ escritorioId: esc.id }, () =>
        svc.processarArquivo(esc.id, f.path, f.originalname, 'API'),
      );
      todos.push(...r);
    }
    return ok(res, { processados: todos.length });
  } catch (e) {
    next(e);
  }
});

// ---------- Demais rotas exigem JWT ----------
router.use(authenticate);

// Caixa do Robo: upload em massa
router.post('/caixa', requirePermission('entregas_baixar'), uploadRobo.array('arquivos', 50), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw Errors.validacao('Envie ao menos um PDF.');
  const resultados = [];
  for (const f of files) {
    const r = await svc.processarArquivo(req.auth!.escritorioId, f.path, f.originalname, 'UPLOAD');
    resultados.push(...r);
  }
  const baixados = resultados.filter((r) => r.status === 'BAIXADO').length;
  const revisao = resultados.filter((r) => r.status === 'REVISAO').length;
  return ok(res, { total: resultados.length, baixados, revisao });
});

// Consulta documento: identifica os arquivos na base de conhecimento (sem baixar)
router.post('/consultar', requirePermission('obrigacoes_ver'), uploadConsulta.array('arquivos', 30), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw Errors.validacao('Selecione ao menos um arquivo.');
  const arquivos = files.map((f) => ({ nome: f.originalname, buffer: f.buffer }));
  const resultados = await svc.consultarDocumentos(req.auth!.escritorioId, arquivos);
  return ok(res, resultados);
});

// Painel / estatisticas
router.get('/painel', async (req, res) => {
  const r = await svc.estatisticas(req.auth!.escritorioId);
  return ok(res, r);
});

// Lista de jobs (log) - filtro por status
router.get('/jobs', async (req, res) => {
  const status = req.query.status as string | undefined;
  const jobs = await prisma.roboJob.findMany({
    where: { escritorioId: req.auth!.escritorioId, ...(status ? { status: status as never } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  // enriquece com nome da empresa
  const empresaIds = [...new Set(jobs.map((j) => j.empresaId).filter(Boolean) as string[])];
  const empresas = await prisma.empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, razaoSocial: true } });
  const mapa = new Map(empresas.map((e) => [e.id, e.razaoSocial]));

  // sugestao automatica de mapeamento (so p/ itens em revisao); valida a obrigacao contra o catalogo
  const obrigs = await prisma.obrigacao.findMany({ where: { escritorioId: req.auth!.escritorioId, deletedAt: null }, select: { nome: true } });
  const nomesObrig = new Set(obrigs.map((o) => o.nome));

  return ok(res, jobs.map((j) => {
    let sugestaoObrigacao: string | null = null;
    let sugestaoPalavras: string[] = [];
    let sugestaoFonte: 'ia' | 'regra' | null = null;
    let sugestaoConfianca: number | null = null;
    if (j.status === 'REVISAO') {
      // 1o) sugestao da IA persistida (so se for um nome valido do catalogo)
      if (j.iaObrigacao && nomesObrig.has(j.iaObrigacao)) {
        sugestaoObrigacao = j.iaObrigacao;
        sugestaoPalavras = (j.iaPalavras as string[]) ?? [];
        sugestaoConfianca = j.iaConfianca ?? null;
        sugestaoFonte = 'ia';
      } else if (j.textoTrecho) {
        // 2o) fallback: regras por palavras-chave
        const s = svc.sugerirMapeamento(j.textoTrecho);
        sugestaoPalavras = s.palavras;
        sugestaoObrigacao = s.obrigacaoNome && nomesObrig.has(s.obrigacaoNome) ? s.obrigacaoNome : null;
        if (sugestaoObrigacao) sugestaoFonte = 'regra';
      }
    }
    return { ...j, empresaNome: j.empresaId ? mapa.get(j.empresaId) ?? null : null, sugestaoObrigacao, sugestaoPalavras, sugestaoFonte, sugestaoConfianca };
  }));
});

// Resolver item de revisao
router.post(
  '/revisao/:id/resolver',
  requirePermission('entregas_baixar'),
  validate({
    body: z.object({
      empresaId: z.string(),
      obrigacaoNome: z.string(),
      competenciaAno: z.number().int(),
      competenciaMes: z.number().int().min(1).max(12),
    }),
  }),
  async (req, res) => {
    const r = await svc.resolverRevisao(req.auth!.escritorioId, req.params.id, req.body);
    return ok(res, r);
  },
);

// Reprocessar um job (re-roda a identificacao automatica - util apos cadastrar/ajustar assinaturas)
router.post('/revisao/:id/reprocessar', requirePermission('entregas_baixar'), async (req, res) => {
  const r = await svc.reprocessarJob(req.auth!.escritorioId, req.params.id);
  return ok(res, r);
});

// Download do PDF de um job (para previa na revisao)
router.get('/jobs/:id/arquivo', async (req, res) => {
  const fs = await import('node:fs');
  const job = await prisma.roboJob.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!job || !fs.existsSync(job.caminho)) throw Errors.naoEncontrado('Arquivo');
  res.setHeader('Content-Type', 'application/pdf');
  return res.sendFile(path.resolve(job.caminho));
});

// API key do escritorio (para ingest)
router.get('/api-key', requirePermission('admin_escritorio'), async (req, res) => {
  const e = await prisma.escritorio.findUniqueOrThrow({ where: { id: req.auth!.escritorioId } });
  return ok(res, { apiKey: (e.config as Record<string, unknown>).roboApiKey ?? null });
});

router.post('/api-key/regenerar', requirePermission('admin_escritorio'), async (req, res) => {
  const e = await prisma.escritorio.findUniqueOrThrow({ where: { id: req.auth!.escritorioId } });
  const novaKey = 'goa_' + generateToken(24);
  await prisma.escritorio.update({
    where: { id: e.id },
    data: { config: { ...(e.config as object), roboApiKey: novaKey } },
  });
  return ok(res, { apiKey: novaKey });
});

export default router;
