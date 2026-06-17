import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { generateToken } from '../../lib/password.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { sendMail } from '../../lib/mailer.js';

const router = Router();
router.use(authenticate);

// Criar protocolo (distribuicao de um documento a um contato)
router.post(
  '/',
  validate({
    body: z.object({
      empresaId: z.string(),
      documentoId: z.string().optional(),
      contatoId: z.string().optional(),
      destinatario: z.string().min(1, 'Informe o destinatario.'),
      canal: z.enum(['EMAIL', 'AREA_VIP', 'WHATSAPP']).default('EMAIL'),
    }),
  }),
  async (req, res) => {
    const token = generateToken(24);
    const protocolo = await prisma.protocolo.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        empresaId: req.body.empresaId,
        documentoId: req.body.documentoId || null,
        contatoId: req.body.contatoId || null,
        destinatario: req.body.destinatario,
        canal: req.body.canal,
        token,
      },
    });
    return ok(res, { id: protocolo.id, token, link: `${env.appUrl}/p/${token}` }, 201);
  },
);

// Consulta por empresa (com visualizacoes)
router.get('/empresa/:empresaId', async (req, res) => {
  const protocolos = await prisma.protocolo.findMany({
    where: { escritorioId: req.auth!.escritorioId, empresaId: req.params.empresaId },
    orderBy: { enviadoEm: 'desc' },
    include: {
      documento: { select: { nomeArquivo: true } },
      visualizacoes: { orderBy: { visualizadoEm: 'desc' } },
    },
  });
  return ok(res, protocolos);
});

// Disparar lembretes de guias nao lidas (job manual; Modulo 13 automatiza)
router.post('/lembretes/disparar', async (req, res) => {
  const dias = Number(req.query.dias ?? 3);
  const limite = new Date(Date.now() - dias * 86400000);
  const naoLidos = await prisma.protocolo.findMany({
    where: {
      escritorioId: req.auth!.escritorioId,
      enviadoEm: { lt: limite },
      lembreteEnviadoEm: null,
      visualizacoes: { none: {} },
      canal: 'EMAIL',
    },
    include: { documento: { select: { nomeArquivo: true } } },
  });
  let enviados = 0;
  for (const p of naoLidos) {
    await sendMail({
      to: p.destinatario,
      subject: `[Guia nao visualizada] ${p.documento?.nomeArquivo ?? 'Documento'}`,
      html: `<p>Voce possui um documento ainda nao visualizado.</p><p><a href="${env.appUrl}/p/${p.token}">Visualizar agora</a></p>`,
    }).catch(() => undefined);
    await prisma.protocolo.update({ where: { id: p.id }, data: { lembreteEnviadoEm: new Date() } });
    enviados++;
  }
  return ok(res, { enviados, encontrados: naoLidos.length });
});

export default router;
