import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { Errors } from '../lib/errors.js';
import { requestContext } from '../context.js';
import type { PermissionFlag } from '@gestoroa/shared';

export interface AuthUser {
  id: string;
  escritorioId: string;
  nome: string;
  email: string;
  permissoes: Record<string, boolean>;
  filtrosForcados: { departamentos?: string[]; tags?: string[] };
}

// Augmenta o Request do Express com o usuario autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

// Middleware: exige access token valido. Carrega usuario+permissoes,
// valida tenant e executa o restante da cadeia dentro do contexto ALS
// (para o middleware de auditoria do Prisma).
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    // Fallback por query param (?token=) para <img>/download que nao enviam header.
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!header?.startsWith('Bearer ') && !queryToken) {
      throw Errors.naoAutenticado();
    }
    const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken!;

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw Errors.naoAutenticado();
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        id: payload.sub,
        escritorioId: payload.escritorioId,
        deletedAt: null,
        ativo: true,
      },
      include: { permissao: true },
    });

    if (!usuario) throw Errors.naoAutenticado();

    const { permissao, ...rest } = usuario;
    const permissoes: Record<string, boolean> = {};
    if (permissao) {
      for (const [k, v] of Object.entries(permissao)) {
        if (typeof v === 'boolean') permissoes[k] = v;
      }
    }

    req.auth = {
      id: rest.id,
      escritorioId: rest.escritorioId,
      nome: rest.nome,
      email: rest.email,
      permissoes,
      filtrosForcados:
        (rest.filtrosForcados as AuthUser['filtrosForcados']) ?? {},
    };

    requestContext.run(
      { escritorioId: rest.escritorioId, usuarioId: rest.id },
      () => next(),
    );
  } catch (err) {
    next(err);
  }
}

// Middleware: exige uma flag de permissao especifica.
export function requirePermission(flag: PermissionFlag) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(Errors.naoAutenticado());
    if (!req.auth.permissoes[flag]) return next(Errors.semPermissao(flag));
    next();
  };
}
