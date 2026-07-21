import { cookies } from 'next/headers';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3011';

/**
 * Chama o backend a partir do SERVIDOR (páginas renderizadas no servidor),
 * repassando o cookie de login do visitante.
 */
export async function apiServer<T>(
  path: string,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  try {
    const res = await fetch(`${API_INTERNAL_URL}/api${path}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });

    const data = res.headers.get('content-type')?.includes('application/json')
      ? await res.json()
      : null;

    return { ok: res.ok, status: res.status, data };
  } catch {
    // Backend ainda subindo, por exemplo.
    return { ok: false, status: 0, data: null };
  }
}
