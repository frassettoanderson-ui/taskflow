import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('obrigacoes_ver'));

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

router.delete('/:id', requirePermission('obrigacoes_gerenciar'), async (req, res) => {
  const existe = await prisma.assinaturaDocumento.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Assinatura');
  await prisma.assinaturaDocumento.delete({ where: { id: req.params.id } });
  return ok(res, { removido: true });
});

export default router;
