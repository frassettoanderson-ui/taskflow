import type { ApiResponse } from '@gestoroa/shared';

const BASE = '/api/v1/portal';
const TOKEN_KEY = 'goa_portal_token';
const EMP_KEY = 'goa_portal_empresa';

export function getPortalToken() { return localStorage.getItem(TOKEN_KEY); }
export function setPortalToken(t: string | null) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }
export function getEmpresaAtual() { return localStorage.getItem(EMP_KEY); }
export function setEmpresaAtual(id: string | null) { id ? localStorage.setItem(EMP_KEY, id) : localStorage.removeItem(EMP_KEY); }

export class PortalError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

async function req<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getPortalToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const emp = getEmpresaAtual();
  if (emp) headers['x-empresa-id'] = emp;
  let body: BodyInit | undefined;
  if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  const res = await fetch(BASE + path, { method: opts.method ?? 'GET', headers, body });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new PortalError('ERRO_REDE', 'Falha de comunicacao.', res.status);
  if (!json.ok) throw new PortalError(json.error.code, json.error.message, res.status);
  return json.data;
}

export const portalApi = {
  get: <T>(p: string) => req<T>(p),
  post: <T>(p: string, body?: unknown) => req<T>(p, { method: 'POST', body }),
  // download com token
  downloadUrl: (p: string) => BASE + p,
  authHeaders: () => {
    const h: Record<string, string> = {};
    const t = getPortalToken(); if (t) h.Authorization = `Bearer ${t}`;
    const e = getEmpresaAtual(); if (e) h['x-empresa-id'] = e;
    return h;
  },
};
