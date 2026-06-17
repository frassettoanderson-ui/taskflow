import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../env.js';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';

interface ContatoTokenPayload {
  email: string;
  escritorioId: string;
  tipo: 'contato';
}

export function signContatoToken(email: string, escritorioId: string): string {
  return jwt.sign({ email, escritorioId, tipo: 'contato' } as ContatoTokenPayload, env.jwt.accessSecret, {
    expiresIn: '12h',
  });
}

export interface ContatoAuth {
  email: string;
  escritorioId: string;
  nome: string;
  empresas: { id: string; razaoSocial: string; departamentoIds: string[]; obrigacaoIds: string[] }[];
  empresaAtual: string; // empresaId selecionada
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      contato?: ContatoAuth;
    }
  }
}

export async function authenticateContato(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Errors.naoAutenticado();
    let payload: ContatoTokenPayload;
    try {
      payload = jwt.verify(header.slice(7), env.jwt.accessSecret) as ContatoTokenPayload;
    } catch {
      throw Errors.naoAutenticado();
    }
    if (payload.tipo !== 'contato') throw Errors.naoAutenticado();

    const rows = await prisma.empresaContato.findMany({
      where: { escritorioId: payload.escritorioId, email: payload.email, ativo: true },
      include: { empresa: { select: { id: true, razaoSocial: true, deletedAt: true } } },
    });
    const validos = rows.filter((r) => r.empresa && !r.empresa.deletedAt);
    if (validos.length === 0) throw Errors.naoAutenticado();

    const empresas = validos.map((r) => ({
      id: r.empresaId,
      razaoSocial: r.empresa!.razaoSocial,
      departamentoIds: (r.departamentoIds as string[]) ?? [],
      obrigacaoIds: (r.obrigacaoIds as string[]) ?? [],
    }));
    const solicitada = req.headers['x-empresa-id'] as string | undefined;
    const empresaAtual = empresas.find((e) => e.id === solicitada)?.id ?? empresas[0].id;

    req.contato = { email: payload.email, escritorioId: payload.escritorioId, nome: validos[0].nome, empresas, empresaAtual };
    next();
  } catch (e) {
    next(e);
  }
}

// Retorna a config de permissao do contato para a empresa atual.
export function permissaoContato(req: Request): { departamentoIds: string[]; obrigacaoIds: string[] } {
  const emp = req.contato!.empresas.find((e) => e.id === req.contato!.empresaAtual)!;
  return { departamentoIds: emp.departamentoIds, obrigacaoIds: emp.obrigacaoIds };
}
