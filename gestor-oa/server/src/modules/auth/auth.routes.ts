import { Router, type Request, type Response } from 'express';
import { env } from '../../env.js';
import { durationToMs } from '../../lib/jwt.js';
import { ok } from '../../lib/http.js';
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

export default router;
