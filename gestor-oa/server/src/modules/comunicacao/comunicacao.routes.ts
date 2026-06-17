import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { getWhatsAppProvider } from './whatsapp.js';
import * as svc from './comunicacao.service.js';

const router = Router();

// ---------- Webhook do WhatsApp (Meta Cloud) - publico (stub) ----------
router.get('/whatsapp/webhook', (req, res) => {
  // verificacao do webhook (Meta)
  if (req.query['hub.verify_token'] === env.whatsapp.verifyToken && req.query['hub.challenge']) {
    return res.send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
});
router.post('/whatsapp/webhook', (req, res) => {
  // STUB: aqui chegariam status de entrega/leitura. Atualizar ComunicacaoLog por id.
  // Ex.: marcar status LIDO quando o evento for "read".
  return res.sendStatus(200);
});

router.use(authenticate);

// ---------- Templates ----------
router.get('/templates', async (req, res) => {
  const itens = await prisma.templateEmail.findMany({ where: { escritorioId: req.auth!.escritorioId }, orderBy: { nome: 'asc' } });
  return ok(res, itens);
});

const tplSchema = z.object({
  tipo: z.enum(['ENTREGA', 'LEMBRETE', 'COMUNICADO', 'GENERICO']).default('GENERICO'),
  nome: z.string().min(2),
  assunto: z.string().min(1),
  corpo: z.string().min(1),
  ativo: z.boolean().optional(),
});

router.post('/templates', requirePermission('portal_configurar'), validate({ body: tplSchema }), async (req, res) => {
  const t = await prisma.templateEmail.create({ data: { escritorioId: req.auth!.escritorioId, ...req.body } });
  return ok(res, t, 201);
});
router.put('/templates/:id', requirePermission('portal_configurar'), validate({ body: tplSchema.partial() }), async (req, res) => {
  const existe = await prisma.templateEmail.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Template');
  const t = await prisma.templateEmail.update({ where: { id: req.params.id }, data: req.body });
  return ok(res, t);
});
router.delete('/templates/:id', requirePermission('portal_configurar'), async (req, res) => {
  await prisma.templateEmail.deleteMany({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  return ok(res, { removido: true });
});

// ---------- Envio manual de e-mail ----------
router.post(
  '/enviar-email',
  validate({ body: z.object({ empresaId: z.string().optional(), to: z.string().email(), assunto: z.string().min(1), corpo: z.string().min(1), documentoId: z.string().optional() }) }),
  async (req, res) => {
    const r = await svc.enviarEmail({
      escritorioId: req.auth!.escritorioId, empresaId: req.body.empresaId, to: req.body.to,
      assunto: req.body.assunto, corpo: req.body.corpo, documentoId: req.body.documentoId, responsavelId: req.auth!.id,
    });
    return ok(res, r);
  },
);

router.post('/:id/reenviar', async (req, res) => {
  const r = await svc.reenviar(req.auth!.escritorioId, req.params.id);
  return ok(res, r);
});

// ---------- Enviar entrega ao cliente (manual) ----------
router.post('/entregas/:entregaId/enviar', requirePermission('entregas_baixar'), async (req, res) => {
  const r = await svc.enviarEntrega(req.auth!.escritorioId, req.params.entregaId, req.auth!.id);
  return ok(res, r);
});

// ---------- WhatsApp: gerar link/envio ----------
router.post(
  '/whatsapp',
  validate({ body: z.object({ empresaId: z.string().optional(), numero: z.string().min(8), mensagem: z.string().min(1) }) }),
  async (req, res) => {
    const provider = getWhatsAppProvider();
    const r = await provider.enviar({ numero: req.body.numero, mensagem: req.body.mensagem });
    // registra a intencao/envio no historico
    await prisma.comunicacaoLog.create({
      data: {
        escritorioId: req.auth!.escritorioId, empresaId: req.body.empresaId ?? null, canal: 'WHATSAPP',
        destinatario: req.body.numero, conteudo: req.body.mensagem,
        status: r.tipo === 'link' ? 'INTENCAO' : 'ENVIADO', responsavelId: req.auth!.id, enviadoEm: r.tipo === 'api' ? new Date() : null,
      },
    });
    return ok(res, r);
  },
);

// ---------- Historico por empresa ----------
router.get('/historico/:empresaId', async (req, res) => {
  const r = await svc.historico(req.auth!.escritorioId, req.params.empresaId);
  return ok(res, r);
});

// ---------- Chatbot ----------
router.get('/chatbots', async (req, res) => {
  const itens = await prisma.chatbotFluxo.findMany({ where: { escritorioId: req.auth!.escritorioId }, orderBy: { nome: 'asc' } });
  return ok(res, itens);
});
const botSchema = z.object({ nome: z.string().min(2), arvore: z.any(), ativo: z.boolean().optional() });
router.post('/chatbots', requirePermission('portal_configurar'), validate({ body: botSchema }), async (req, res) => {
  const b = await prisma.chatbotFluxo.create({ data: { escritorioId: req.auth!.escritorioId, nome: req.body.nome, arvore: req.body.arvore ?? {}, ativo: req.body.ativo ?? true } });
  return ok(res, b, 201);
});
router.put('/chatbots/:id', requirePermission('portal_configurar'), validate({ body: botSchema.partial() }), async (req, res) => {
  const existe = await prisma.chatbotFluxo.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  if (!existe) throw Errors.naoEncontrado('Chatbot');
  const b = await prisma.chatbotFluxo.update({ where: { id: req.params.id }, data: req.body });
  return ok(res, b);
});
router.delete('/chatbots/:id', requirePermission('portal_configurar'), async (req, res) => {
  await prisma.chatbotFluxo.deleteMany({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId } });
  return ok(res, { removido: true });
});

export default router;
