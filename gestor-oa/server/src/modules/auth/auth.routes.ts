import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { env } from '../../env.js';
import { escritorioDir } from '../../lib/storage.js';
import { prisma } from '../../prisma.js';
import { durationToMs } from '../../lib/jwt.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import * as authService from './auth.service.js';
import {
  registrarEscritorioSchema,
  loginSchema,
  solicitarResetSchema,
  redefinirSenhaSchema,
} from './auth.schemas.js';

const router = Router();

// Uploads do proprio perfil (foto / assinatura) - imagens ate 2MB
function uploadPerfil(sub: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, _f, cb) => cb(null, escritorioDir(req.auth!.escritorioId, sub)),
      filename: (req, file, cb) => cb(null, `${req.auth!.id}${path.extname(file.originalname) || '.png'}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_r, file, cb) => cb(null, /^image\//.test(file.mimetype)),
  });
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(env.jwt.refreshCookieName, token, {
    httpOnly: true,
    secure: env.jwt.cookieSecure,
    sameSite: 'lax',
    maxAge: durationToMs(env.jwt.refreshExpires),
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.jwt.refreshCookieName, { path: '/api/v1/auth' });
}

function meta(req: Request): authService.SessionMeta {
  return {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  };
}

router.post(
  '/registrar',
  validate({ body: registrarEscritorioSchema }),
  async (req, res) => {
    const { sessao, refreshToken } = await authService.registrarEscritorio(
      req.body,
      meta(req),
    );
    setRefreshCookie(res, refreshToken);
    return ok(res, sessao, 201);
  },
);

router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  const { sessao, refreshToken } = await authService.login(req.body, meta(req));
  setRefreshCookie(res, refreshToken);
  return ok(res, sessao);
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.[env.jwt.refreshCookieName];
  const { sessao, refreshToken } = await authService.refresh(token, meta(req));
  setRefreshCookie(res, refreshToken);
  return ok(res, sessao);
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[env.jwt.refreshCookieName];
  await authService.logout(token);
  clearRefreshCookie(res);
  return ok(res, { loggedOut: true });
});

router.post(
  '/esqueci-senha',
  validate({ body: solicitarResetSchema }),
  async (req, res) => {
    await authService.solicitarReset(req.body.email);
    // resposta sempre generica (privacidade)
    return ok(res, {
      mensagem:
        'Se o e-mail existir, enviaremos instrucoes para redefinir a senha.',
    });
  },
);

router.post(
  '/redefinir-senha',
  validate({ body: redefinirSenhaSchema }),
  async (req, res) => {
    await authService.redefinirSenha(req.body.token, req.body.novaSenha);
    return ok(res, { mensagem: 'Senha redefinida com sucesso.' });
  },
);

router.get('/me', authenticate, async (req, res) => {
  const sessao = await authService.sessaoAtual(req.auth!.id);
  return ok(res, sessao);
});

// ---------- Dados do meu perfil (auto-edicao do usuario logado) ----------
router.get('/perfil', authenticate, async (req, res) => {
  const u = await prisma.usuario.findUniqueOrThrow({
    where: { id: req.auth!.id },
    select: {
      nome: true, email: true, tipo: true, telefone: true, observacoes: true,
      smtpHost: true, smtpPorta: true, smtpUsuario: true, smtpSenha: true, ccoEmails: true,
      assinaturaArquivo: true, fotoPerfilArquivo: true,
      notifSolicitacoesEmail: true, notifMarketingEmail: true,
    },
  });
  const { smtpSenha, assinaturaArquivo, fotoPerfilArquivo, ...rest } = u;
  return ok(res, { ...rest, temSmtpSenha: !!smtpSenha, temAssinatura: !!assinaturaArquivo, temFoto: !!fotoPerfilArquivo });
});

router.put(
  '/perfil',
  authenticate,
  validate({
    body: z.object({
      nome: z.string().min(2, 'Informe o nome.'),
      telefone: z.string().optional().nullable(),
      observacoes: z.string().optional().nullable(),
      senhaAtual: z.string().optional(),
      novaSenha: z.string().min(8, 'Nova senha deve ter ao menos 8 caracteres.').optional(),
      smtpHost: z.string().optional().nullable(),
      smtpPorta: z.number().int().optional().nullable(),
      smtpUsuario: z.string().optional().nullable(),
      smtpSenha: z.string().optional().nullable(),
      ccoEmails: z.string().optional().nullable(),
      notifSolicitacoesEmail: z.boolean().optional(),
      notifMarketingEmail: z.boolean().optional(),
    }),
  }),
  async (req, res) => {
    const b = req.body as {
      nome: string; telefone?: string | null; observacoes?: string | null; senhaAtual?: string; novaSenha?: string;
      smtpHost?: string | null; smtpPorta?: number | null; smtpUsuario?: string | null; smtpSenha?: string | null;
      ccoEmails?: string | null; notifSolicitacoesEmail?: boolean; notifMarketingEmail?: boolean;
    };
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: req.auth!.id } });

    let senhaHash: string | undefined;
    if (b.novaSenha) {
      if (!b.senhaAtual || !(await verifyPassword(b.senhaAtual, u.senhaHash))) {
        throw Errors.validacao('Senha atual incorreta.');
      }
      senhaHash = await hashPassword(b.novaSenha);
    }

    await prisma.usuario.update({
      where: { id: u.id },
      data: {
        nome: b.nome, telefone: b.telefone ?? null, observacoes: b.observacoes ?? null,
        smtpHost: b.smtpHost === undefined ? undefined : b.smtpHost,
        smtpPorta: b.smtpPorta === undefined ? undefined : b.smtpPorta,
        smtpUsuario: b.smtpUsuario === undefined ? undefined : b.smtpUsuario,
        smtpSenha: b.smtpSenha ? b.smtpSenha : undefined,
        ccoEmails: b.ccoEmails === undefined ? undefined : b.ccoEmails,
        notifSolicitacoesEmail: b.notifSolicitacoesEmail ?? undefined,
        notifMarketingEmail: b.notifMarketingEmail ?? undefined,
        ...(senhaHash ? { senhaHash } : {}),
      },
    });
    return ok(res, { atualizado: true });
  },
);

// Upload/serve foto de perfil
router.post('/perfil/foto', authenticate, uploadPerfil('fotos-usuario').single('arquivo'), async (req, res) => {
  if (!req.file) throw Errors.validacao('Envie uma imagem.');
  await prisma.usuario.update({ where: { id: req.auth!.id }, data: { fotoPerfilArquivo: req.file.filename } });
  return ok(res, { ok: true });
});
router.get('/perfil/foto', authenticate, async (req, res) => {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { id: req.auth!.id } });
  if (!u.fotoPerfilArquivo) throw Errors.naoEncontrado('Foto');
  const arq = path.join(escritorioDir(req.auth!.escritorioId, 'fotos-usuario'), u.fotoPerfilArquivo);
  if (!fs.existsSync(arq)) throw Errors.naoEncontrado('Foto');
  return res.sendFile(arq);
});

// Upload/serve assinatura do proprio usuario
router.post('/perfil/assinatura', authenticate, uploadPerfil('assinaturas-usuario').single('arquivo'), async (req, res) => {
  if (!req.file) throw Errors.validacao('Envie uma imagem.');
  await prisma.usuario.update({ where: { id: req.auth!.id }, data: { assinaturaArquivo: req.file.filename } });
  return ok(res, { ok: true });
});
router.get('/perfil/assinatura', authenticate, async (req, res) => {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { id: req.auth!.id } });
  if (!u.assinaturaArquivo) throw Errors.naoEncontrado('Assinatura');
  const arq = path.join(escritorioDir(req.auth!.escritorioId, 'assinaturas-usuario'), u.assinaturaArquivo);
  if (!fs.existsSync(arq)) throw Errors.naoEncontrado('Assinatura');
  return res.sendFile(arq);
});

export default router;
