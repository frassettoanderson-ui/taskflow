import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import archiver from 'archiver';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { empresaDir, isInsideStorage } from '../../lib/storage.js';
import * as svc from './ged.service.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('documentos_ver'));

// Painel de armazenamento (global)
router.get('/armazenamento', requirePermission('relatorios_ver'), async (req, res) => {
  const r = await svc.painelArmazenamento(req.auth!.escritorioId);
  return ok(res, r);
});

// Listar documentos de uma empresa
router.get('/empresa/:empresaId', async (req, res) => {
  const r = await svc.listar(req.auth!.escritorioId, req.params.empresaId, {
    raiz: req.query.raiz as string | undefined,
    busca: req.query.busca as string | undefined,
  });
  return ok(res, r);
});

// Upload manual (DocsEmpresa, com subpasta livre)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const pasta = (req.body.pasta as string) || '';
      const safe = pasta.replace(/\.\./g, '').replace(/[^\w/\- ]/g, '_');
      cb(null, empresaDir(req.params.empresaId, 'DocsEmpresa', safe));
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.post(
  '/empresa/:empresaId/upload',
  requirePermission('documentos_upload'),
  upload.array('arquivos', 30),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw Errors.validacao('Envie ao menos um arquivo.');
    const pasta = ((req.body.pasta as string) || '').replace(/\.\./g, '').replace(/[^\w/\- ]/g, '_');
    const criados = [];
    for (const f of files) {
      criados.push(
        await svc.adicionar(req.auth!.escritorioId, req.params.empresaId, {
          raiz: 'DocsEmpresa',
          pasta,
          nomeArquivo: f.originalname,
          caminho: f.path,
          tamanho: f.size,
          mimeType: f.mimetype,
          origem: 'MANUAL',
          uploadedById: req.auth!.id,
        }),
      );
    }
    return ok(res, criados, 201);
  },
);

router.get('/:id/download', async (req, res) => {
  const doc = await prisma.documentoGED.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
  });
  if (!doc || !isInsideStorage(doc.caminho) || !fs.existsSync(doc.caminho)) throw Errors.naoEncontrado('Documento');
  return res.download(doc.caminho, doc.nomeArquivo);
});

// Download em lote (zip) dos documentos de uma empresa/raiz
router.get('/empresa/:empresaId/zip', async (req, res) => {
  const docs = await svc.listar(req.auth!.escritorioId, req.params.empresaId, {
    raiz: req.query.raiz as string | undefined,
  });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="documentos.zip"');
  const zip = archiver('zip', { zlib: { level: 9 } });
  zip.pipe(res);
  for (const d of docs) {
    if (isInsideStorage(d.caminho) && fs.existsSync(d.caminho)) {
      const nomeNoZip = path.join(d.raiz, d.pasta, d.nomeArquivo);
      zip.file(d.caminho, { name: nomeNoZip });
    }
  }
  await zip.finalize();
});

router.delete('/:id', requirePermission('documentos_excluir'), async (req, res) => {
  const doc = await prisma.documentoGED.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
  });
  if (!doc) throw Errors.naoEncontrado('Documento');
  // Remove arquivo apenas se nao for referencia de entrega (evita apagar anexo da entrega)
  if (doc.origem === 'MANUAL' && isInsideStorage(doc.caminho)) {
    fs.promises.unlink(doc.caminho).catch(() => undefined);
  }
  await prisma.documentoGED.delete({ where: { id: doc.id } });
  return ok(res, { removido: true });
});

export default router;
