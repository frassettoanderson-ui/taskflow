import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { ensureDir, STORAGE_ROOT, isInsideStorage } from '../../lib/storage.js';
import * as svc from './acdox.service.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('documentos_ver'));

// ---------- Reguas de cobranca ----------
const reguaSchema = z.object({
  nome: z.string().min(1, 'Informe o nome.'),
  diaLimite: z.number().int().min(1).max(31).default(10),
  departamentoId: z.string().optional().nullable(),
  lembreteAntesDias: z.number().int().min(0).max(60).optional().nullable(),
  lembreteDepoisDias: z.number().int().min(0).max(60).optional().nullable(),
  modeloEmail: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
  itens: z.array(z.string().min(1)).default([]),
  empresaIds: z.array(z.string()).default([]),
});

router.get('/reguas', async (req, res) => ok(res, await svc.listarReguas(req.auth!.escritorioId)));
router.get('/reguas/:id', async (req, res) => ok(res, await svc.obterRegua(req.auth!.escritorioId, req.params.id)));
router.post('/reguas', requirePermission('documentos_upload'), validate({ body: reguaSchema }), async (req, res) => ok(res, await svc.criarRegua(req.auth!.escritorioId, req.body), 201));
router.put('/reguas/:id', requirePermission('documentos_upload'), validate({ body: reguaSchema.partial() }), async (req, res) => ok(res, await svc.editarRegua(req.auth!.escritorioId, req.params.id, req.body)));
router.delete('/reguas/:id', requirePermission('documentos_upload'), async (req, res) => { await svc.excluirRegua(req.auth!.escritorioId, req.params.id); return ok(res, { removida: true }); });

// ---------- Geracao de cobrancas ----------
router.post('/gerar', requirePermission('documentos_upload'), validate({ body: z.object({ ano: z.number().int(), mes: z.number().int().min(1).max(12) }) }), async (req, res) => {
  const r = await svc.gerarCompetencia(req.auth!.escritorioId, req.body.ano, req.body.mes);
  return ok(res, r);
});

// ---------- Dashboard ----------
router.get('/dashboard', async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;
  const mes = req.query.mes ? Number(req.query.mes) : undefined;
  return ok(res, await svc.dashboard(req.auth!.escritorioId, ano, mes));
});

// ---------- Cobrancas ----------
router.get('/cobrancas', async (req, res) => {
  const q = req.query as Record<string, string>;
  return ok(res, await svc.listarCobrancas(req.auth!.escritorioId, {
    ano: q.ano ? Number(q.ano) : undefined, mes: q.mes ? Number(q.mes) : undefined,
    status: q.status || undefined, reguaId: q.reguaId || undefined,
  }));
});
router.get('/cobrancas/:id', async (req, res) => ok(res, await svc.obterCobranca(req.auth!.escritorioId, req.params.id)));

// download do documento anexado a um item da cobranca
router.get('/cobrancas/:id/itens/:itemId/arquivo', async (req, res) => {
  const cob = await prisma.cobrancaDoc.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!cob) throw Errors.naoEncontrado('Cobranca');
  const item = await prisma.cobrancaDocItem.findFirst({ where: { id: req.params.itemId, cobrancaId: cob.id } });
  if (!item?.arquivo) throw Errors.naoEncontrado('Documento');
  if (!isInsideStorage(item.arquivo) || !fs.existsSync(item.arquivo)) throw Errors.naoEncontrado('Arquivo');
  return res.download(item.arquivo, path.basename(item.arquivo).replace(/^\d+_/, ''));
});

// validar/recusar/receber um item (com upload opcional do documento)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _f, cb) => cb(null, ensureDir(path.join(STORAGE_ROOT, 'acdox', req.params.id))),
    filename: (_r, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/cobrancas/:id/itens/:itemId/acao', requirePermission('documentos_upload'), upload.single('arquivo'), async (req, res) => {
  const acao = req.body.acao as 'receber' | 'validar' | 'recusar';
  const arquivo = (req.file as Express.Multer.File | undefined)?.path;
  const r = await svc.acaoItem(req.auth!.escritorioId, req.params.id, req.params.itemId, acao, { justificativa: req.body.justificativa, arquivo }, req.auth!.id);
  return ok(res, r);
});

export default router;
