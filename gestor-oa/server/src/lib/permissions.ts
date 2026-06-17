import { PERMISSION_FLAGS, type PermissionFlag } from '@gestoroa/shared';

// Objeto de permissoes com todas as flags em um mesmo valor.
export function allPermissions(value: boolean): Record<PermissionFlag, boolean> {
  return Object.fromEntries(
    PERMISSION_FLAGS.map((f) => [f, value]),
  ) as Record<PermissionFlag, boolean>;
}

// Sanitiza um objeto de permissoes vindo da API, mantendo apenas flags conhecidas.
export function sanitizePermissions(
  input: Partial<Record<string, boolean>> | undefined | null,
): Record<PermissionFlag, boolean> {
  const base = allPermissions(false);
  if (!input) return base;
  for (const f of PERMISSION_FLAGS) {
    if (typeof input[f] === 'boolean') base[f] = input[f] as boolean;
  }
  return base;
}
