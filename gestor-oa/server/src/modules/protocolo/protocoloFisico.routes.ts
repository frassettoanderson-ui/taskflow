import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { empresaDir } from '../../lib/storage.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('documentos_ver'));

// Listar (filtros: empresaId, status, periodo)
router.get('/', async (req, res) => {
  const q = req.query as Record<string, string>;
  const where: Prisma.ProtocoloFisicoWhereInput = { escritorioId: req.auth!.escritorioId };
  if (q.empresaId) where.empresaId = q.empresaId;
  if (q.status) where.status = q.status as never;
  const itens = await prisma.protocoloFisico.findMany({
    where,
    orderBy: { data: 'desc' },
    include: { empresa: { select: { razaoSocial: true } } },
  });
  return ok(res, itens);
});

const upsert = z.object({
  empresaId: z.string(),
  descricao: z.string().min(1, 'Descreva os documentos.'),
  retiradoPor: z.string().optional().nullable(),
  data: z.string().optional(),
  status: z.enum(['AGUARDANDO_RETIRADA', 'ENTREGUE', 'DEVOLVIDO', 'CANCELADO']).optional(),
});

router.post('/', requirePermission('documentos_upload'), validate({ body: upsert }), async (req, res) => {
  const p = await prisma.protocoloFisico.create({
    data: {
      escritorioId: req.auth!.escritorioId,
      empresaId: req.body.empresaId,
      descricao: req.body.descricao,
      retiradoPor: req.body.retiradoPor || null,
      data: req.body.data ? new Date(req.body.data) : new Date(),
      status: req.body.status ?? 'AGUARDANDO_RETIRADA',
    },
  });
  return ok(res, p, 201);
});

router.put('/:id', requirePermission('documentos_upload'), validate({ body: upsert.partial() }), async (req, res) => {
  const existe = await prisma.protocoloFisico.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Protocolo');
  const p = await prisma.protocoloFisico.update({
    where: { id: req.params.id },
    data: {
      descricao: req.body.descricao ?? existe.descricao,
      retiradoPor: req.body.retiradoPor === undefined ? existe.retiradoPor : req.body.retiradoPor || null,
      status: req.body.status ?? existe.status,
    },
  });
  return ok(res, p);
});

// Assinatura (canvas em base64 dataURL)
router.post(
  '/:id/assinatura',
  requirePermission('documentos_upload'),
  validate({ body: z.object({ imagemBase64: z.string() }) }),
  async (req, res) => {
    const p = await prisma.protocoloFisico.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
    if (!p) throw Errors.naoEncontrado('Protocolo');
    const base64 = req.body.imagemBase64.replace(/^data:image\/\w+;base64,/, '');
    const dir = empresaDir(p.empresaId, 'protocolos');
    const arquivo = path.join(dir, `${p.id}.png`);
    fs.writeFileSync(arquivo, Buffer.from(base64, 'base64'));
    await prisma.protocoloFisico.update({ where: { id: p.id }, data: { assinaturaPath: arquivo, status: 'ENTREGUE' } });
    return ok(res, { ok: true });
  },
);

// Recibo em HTML (imprimivel)
router.get('/:id/recibo', async (req, res) => {
  const p = await prisma.protocoloFisico.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    include: { empresa: true, escritorio: true },
  });
  if (!p) throw Errors.naoEncontrado('Protocolo');
  let assinaturaImg = '';
  if (p.assinaturaPath && fs.existsSync(p.assinaturaPath)) {
    const b64 = fs.readFileSync(p.assinaturaPath).toString('base64');
    assinaturaImg = `<img src="data:image/png;base64,${b64}" style="max-height:80px"/>`;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo</title>
  <style>body{font-family:system-ui;max-width:600px;margin:2rem auto;color:#1e293b}
  h1{color:#0f5c5e;font-size:1.3rem} .box{border:1px solid #cbd5e1;border-radius:8px;padding:1rem;margin:1rem 0}
  .lbl{color:#64748b;font-size:.8rem} button{background:#0f5c5e;color:#fff;border:0;padding:.6rem 1rem;border-radius:6px;cursor:pointer}
  @media print{button{display:none}}</style></head><body>
  <h1>${p.escritorio.nome} — Recibo de Protocolo Fisico</h1>
  <div class="box">
    <p><span class="lbl">Empresa:</span><br>${p.empresa.razaoSocial}</p>
    <p><span class="lbl">Documentos:</span><br>${p.descricao}</p>
    <p><span class="lbl">Retirado/recebido por:</span><br>${p.retiradoPor ?? '—'}</p>
    <p><span class="lbl">Data:</span> ${new Date(p.data).toLocaleString('pt-BR')}</p>
    <p><span class="lbl">Status:</span> ${p.status}</p>
    <p><span class="lbl">Assinatura:</span><br>${assinaturaImg || '________________________'}</p>
  </div>
  <button onclick="window.print()">Imprimir</button>
  </body></html>`);
});

export default router;
