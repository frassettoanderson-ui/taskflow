import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface AccessTokenPayload {
  sub: string; // usuarioId
  escritorioId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

// Converte "7d" / "15m" em milissegundos (para expiresAt e cookie maxAge).
export function durationToMs(d: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(d.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return n * mult;
}
