import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Token aleatorio opaco (para refresh e reset de senha).
export function generateToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// Hash determinístico (SHA-256) para armazenar tokens com lookup por igualdade.
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
