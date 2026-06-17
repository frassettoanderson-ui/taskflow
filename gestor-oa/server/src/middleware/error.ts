import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { fail } from '../lib/http.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  if (err instanceof ZodError) {
    return fail(res, 422, 'VALIDACAO', 'Dados invalidos.', {
      issues: err.issues.map((i) => ({
        campo: i.path.join('.'),
        mensagem: i.message,
      })),
    });
  }

  if (err instanceof AppError) {
    return fail(res, err.status, err.code, err.message, err.details);
  }

  // Erro inesperado
  console.error('[erro nao tratado]', err);
  return fail(
    res,
    500,
    'ERRO_INTERNO',
    'Ocorreu um erro inesperado. Tente novamente.',
  );
}

export function notFoundHandler(_req: Request, res: Response): Response {
  return fail(res, 404, 'ROTA_NAO_ENCONTRADA', 'Rota nao encontrada.');
}
