import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { escritorioDir } from '../../lib/storage.js';
import { env } from '../../env.js';

const router = Router();

router.use(authenticate);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, escritorioDir(req.auth!.escritorioId));
    },
    filename: (_req, file, cb) => {
      cb(null, `logo${path.extname(file.originalname) || '.png'}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /^image\//.test(file.mimetype));
  },
});

// GET configuracoes do escritorio
router.get('/', async (req, res) => {
  const e = await prisma.escritorio.findUniqueOrThrow({
    where: { id: req.auth!.escritorioId },
  });
  return ok(res, {
    id: e.id,
    nome: e.nome,
    cnpj: e.cnpj,
    logoUrl: e.logoUrl,
    config: e.config,
  });
});

const updateSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto.').optional(),
  cnpj: z.string().optional().nullable(),
  config: z
    .object({
      mailFromName: z.string().optional(),
      sabadoEhUtil: z.boolean().optional(),
      smtp: z
        .object({
          host: z.string().optional(),
          port: z.number().optional(),
          secure: z.boolean().optional(),
          user: z.string().optional(),
          pass: z.string().optional(),
          fromEmail: z.string().email('E-mail invalido.').optional(),
        })
        .partial()
        .optional(),
    })
    .passthrough()
    .optional(),
});

// PUT configuracoes (dados cadastrais, From, SMTP proprio)
router.put(
  '/',
  requirePermission('admin_escritorio'),
  validate({ body: updateSchema }),
  async (req, res) => {
    const atual = await prisma.escritorio.findUniqueOrThrow({
      where: { id: req.auth!.escritorioId },
    });
    const novaConfig = req.body.config
      ? { ...(atual.config as object), ...req.body.config }
      : atual.config;

    const e = await prisma.escritorio.update({
      where: { id: req.auth!.escritorioId },
      data: {
        nome: req.body.nome ?? atual.nome,
        cnpj:
          req.body.cnpj === undefined
            ? atual.cnpj
            : req.body.cnpj?.replace(/\D/g, '') || null,
        config: novaConfig,
      },
    });
    return ok(res, { id: e.id, nome: e.nome, cnpj: e.cnpj, config: e.config });
  },
);

// POST upload de logo
router.post(
  '/logo',
  requirePermission('admin_escritorio'),
  upload.single('logo'),
  async (req, res) => {
    if (!req.file) throw Errors.validacao('Envie um arquivo de imagem.');
    const logoUrl = `${env.apiUrl}/api/v1/escritorio/logo/arquivo?v=${Date.now()}`;
    await prisma.escritorio.update({
      where: { id: req.auth!.escritorioId },
      data: { logoUrl },
    });
    return ok(res, { logoUrl });
  },
);

// DELETE logo (remove o arquivo e zera a URL)
router.delete('/logo', requirePermission('admin_escritorio'), async (req, res) => {
  const dir = escritorioDir(req.auth!.escritorioId);
  const fs = await import('node:fs');
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('logo')) fs.unlinkSync(path.join(dir, f));
    }
  } catch { /* sem arquivo */ }
  await prisma.escritorio.update({
    where: { id: req.auth!.escritorioId },
    data: { logoUrl: null },
  });
  return ok(res, { removido: true });
});

// GET arquivo do logo (servido autenticado)
router.get('/logo/arquivo', async (req, res) => {
  const dir = escritorioDir(req.auth!.escritorioId);
  const fs = await import('node:fs');
  const arquivo = fs
    .readdirSync(dir)
    .find((f) => f.startsWith('logo'));
  if (!arquivo) throw Errors.naoEncontrado('Logo');
  return res.sendFile(path.join(dir, arquivo));
});

export default router;
