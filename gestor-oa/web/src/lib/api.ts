import type { ApiResponse } from '@gestoroa/shared';

// Token de acesso mantido em memoria (refresh fica no cookie httpOnly).
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  // se a requisicao for FormData, nao serializa como JSON
  formData?: FormData;
  retry?: boolean;
}

async function rawRequest<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(BASE + path, {
    method: opts.method ?? 'GET',
    headers,
    body,
    credentials: 'include',
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  // Tenta refresh uma vez em caso de 401.
  if (res.status === 401 && !opts.retry && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return rawRequest<T>(path, { ...opts, retry: true });
    }
  }

  if (!json) {
    throw new ApiError('ERRO_REDE', 'Falha de comunicacao com o servidor.', res.status);
  }
  if (!json.ok) {
    throw new ApiError(json.error.code, json.error.message, res.status, json.error.details);
  }
  return json.data;
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(BASE + '/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (r) => {
        if (!r.ok) return false;
        const j = await r.json();
        if (j?.ok && j.data?.accessToken) {
          accessToken = j.data.accessToken;
          return true;
        }
        return false;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export const api = {
  get: <T>(path: string) => rawRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    rawRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) =>
    rawRequest<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => rawRequest<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    rawRequest<T>(path, { method: 'POST', formData }),
  refresh: tryRefresh,
};
