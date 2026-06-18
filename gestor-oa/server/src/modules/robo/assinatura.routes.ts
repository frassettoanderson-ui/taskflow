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
import { escritorioDir } from '../../lib/storage.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('obrigacoes_ver'));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => cb(null, escritorioDir(req.auth!.escritorioId, 'assinatura-exemplos')),
    filename: (req, file, cb) => cb(null, `${req.params.id}${path.extname(file.originalname) || '.pdf'}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
});

router.get('/', async (req, res) => {
  const itens = await prisma.assinaturaDocumento.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
  });
  return ok(res, itens);
});

const schema = z.object({
  nome: z.string().min(2),
  obrigacaoNome: z.string().min(2),
  palavras: z.array(z.string()).default([]),
  regexCompetencia: z.string().optional().nullable(),
  regexVencimento: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  enviaEmail: z.string().optional(),
  copiaLocal: z.boolean().optional(),
  aoReenviar: z.string().optional(),
  semDemanda: z.string().optional(),
});

router.post('/', requirePermission('obrigacoes_gerenciar'), validate({ body: schema }), async (req, res) => {
  const a = await prisma.assinaturaDocumento.create({
    data: { escritorioId: req.auth!.escritorioId, ...req.body },
  });
  return ok(res, a, 201);
});

router.put('/:id', requirePermission('obrigacoes_gerenciar'), validate({ body: schema.partial() }), async (req, res) => {
  const existe = await prisma.assinaturaDocumento.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Assinatura');
  const a = await prisma.assinaturaDocumento.update({ where: { id: req.params.id }, data: req.body });
  return ok(res, a);
});

// Upload do PDF de exemplo (guia reconhecida nessa entrega)
router.post('/:id/exemplo', requirePermission('obrigacoes_gerenciar'), upload.single('arquivo'), async (req, res) => {
  const existe = await prisma.assinaturaDocumento.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Assinatura');
  if (!req.file) throw Errors.validacao('Envie um arquivo PDF.');
  await prisma.assinaturaDocumento.update({ where: { id: req.params.id }, data: { exemploArquivo: req.file.filename } });
  return ok(res, { exemploArquivo: req.file.filename });
});

// Visualizar o PDF de exemplo
router.get('/:id/exemplo', async (req, res) => {
  const a = await prisma.assinaturaDocumento.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!a || !a.exemploArquivo) throw Errors.naoEncontrado('Exemplo');
  const arquivo = path.join(escritorioDir(req.auth!.escritorioId, 'assinatura-exemplos'), a.exemploArquivo);
  if (!fs.existsSync(arquivo)) throw Errors.naoEncontrado('Exemplo');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${a.exemploArquivo}"`);
  return res.sendFile(arquivo);
});

router.delete('/:id', requirePermission('obrigacoes_gerenciar'), async (req, res) => {
  const existe = await prisma.assinaturaDocumento.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Assinatura');
  await prisma.assinaturaDocumento.delete({ where: { id: req.params.id } });
  return ok(res, { removido: true });
});

export default router;
