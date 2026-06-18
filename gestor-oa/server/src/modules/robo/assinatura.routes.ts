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
  obrigacaoNome: z.string().optional(),
  obrigacoesCorrespondentes: z.array(z.string()).optional(),
  palavras: z.array(z.string()).default([]),
  regexCompetencia: z.string().optional().nullable(),
  regexVencimento: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  enviaEmail: z.string().optional(),
  copiaLocal: z.boolean().optional(),
  aoReenviar: z.string().optional(),
  semDemanda: z.string().optional(),
  miniNomeLocal: z.string().optional().nullable(),
  caminhoLocal: z.string().optional().nullable(),
  anteciparVcto: z.boolean().optional(),
  msgAlertaAntecipado: z.string().optional().nullable(),
  consideraVcto: z.boolean().optional(),
});

router.post('/', requirePermission('obrigacoes_gerenciar'), validate({ body: schema }), async (req, res) => {
  const b = req.body as z.infer<typeof schema>;
  const obrigs = b.obrigacoesCorrespondentes ?? (b.obrigacaoNome ? [b.obrigacaoNome] : []);
  const a = await prisma.assinaturaDocumento.create({
    data: {
      escritorioId: req.auth!.escritorioId,
      nome: b.nome,
      obrigacaoNome: obrigs[0] ?? b.obrigacaoNome ?? '',
      obrigacoesCorrespondentes: obrigs,
      palavras: b.palavras ?? [],
      regexCompetencia: b.regexCompetencia ?? null,
      regexVencimento: b.regexVencimento ?? null,
      ativo: b.ativo ?? true,
      enviaEmail: b.enviaEmail ?? 'Sim - Imediato',
      copiaLocal: b.copiaLocal ?? true,
      aoReenviar: b.aoReenviar ?? 'Reprocessa e desativa arquivos anteriores',
      semDemanda: b.semDemanda ?? 'Criar entrega/demanda',
      miniNomeLocal: b.miniNomeLocal ?? null,
      caminhoLocal: b.caminhoLocal ?? null,
      anteciparVcto: b.anteciparVcto ?? true,
      msgAlertaAntecipado: b.msgAlertaAntecipado ?? null,
      consideraVcto: b.consideraVcto ?? true,
    },
  });
  return ok(res, a, 201);
});

router.put('/:id', requirePermission('obrigacoes_gerenciar'), validate({ body: schema.partial() }), async (req, res) => {
  const existe = await prisma.assinaturaDocumento.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Assinatura');
  const b = req.body as Partial<z.infer<typeof schema>>;
  const obrigs = b.obrigacoesCorrespondentes;
  const a = await prisma.assinaturaDocumento.update({
    where: { id: req.params.id },
    data: {
      nome: b.nome ?? existe.nome,
      obrigacaoNome: obrigs ? (obrigs[0] ?? '') : (b.obrigacaoNome ?? existe.obrigacaoNome),
      obrigacoesCorrespondentes: obrigs ?? (existe.obrigacoesCorrespondentes as string[]),
      palavras: b.palavras ?? (existe.palavras as string[]),
      regexCompetencia: b.regexCompetencia === undefined ? existe.regexCompetencia : b.regexCompetencia,
      regexVencimento: b.regexVencimento === undefined ? existe.regexVencimento : b.regexVencimento,
      ativo: b.ativo ?? existe.ativo,
      enviaEmail: b.enviaEmail ?? existe.enviaEmail,
      copiaLocal: b.copiaLocal ?? existe.copiaLocal,
      aoReenviar: b.aoReenviar ?? existe.aoReenviar,
      semDemanda: b.semDemanda ?? existe.semDemanda,
      miniNomeLocal: b.miniNomeLocal === undefined ? existe.miniNomeLocal : b.miniNomeLocal,
      caminhoLocal: b.caminhoLocal === undefined ? existe.caminhoLocal : b.caminhoLocal,
      anteciparVcto: b.anteciparVcto ?? existe.anteciparVcto,
      msgAlertaAntecipado: b.msgAlertaAntecipado === undefined ? existe.msgAlertaAntecipado : b.msgAlertaAntecipado,
      consideraVcto: b.consideraVcto ?? existe.consideraVcto,
    },
  });
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
