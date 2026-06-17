import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';

// Raiz do armazenamento (disco local do VPS em producao).
export const STORAGE_ROOT = path.resolve(env.storageRoot);

// Garante a existencia de um diretorio (recursivo).
export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Caminho absoluto de uma pasta de empresa: /storage/empresas/{empresaId}/...
export function empresaDir(empresaId: string, ...sub: string[]): string {
  return ensureDir(path.join(STORAGE_ROOT, 'empresas', empresaId, ...sub));
}

// Caminho de assets do escritorio (ex.: logo).
export function escritorioDir(escritorioId: string, ...sub: string[]): string {
  return ensureDir(path.join(STORAGE_ROOT, 'escritorios', escritorioId, ...sub));
}

// Garante que um caminho resolvido esteja dentro da raiz de storage
// (defesa contra path traversal).
export function isInsideStorage(p: string): boolean {
  const resolved = path.resolve(p);
  return resolved.startsWith(STORAGE_ROOT + path.sep) || resolved === STORAGE_ROOT;
}
