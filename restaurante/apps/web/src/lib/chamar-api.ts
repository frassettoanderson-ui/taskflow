'use client';

/**
 * Um atalho para falar com o backend do cadastro.
 *
 * Concentra o tratamento de erro num lugar só: todas as telas de cadastro
 * mostram a mensagem que o servidor mandou, em português, em vez de um
 * "algo deu errado" genérico.
 */
export async function chamarApi<T = any>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown } = {},
): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`/api${caminho}`, {
      method: opcoes.metodo ?? 'GET',
      headers: opcoes.corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      cache: 'no-store',
    });

    const dados = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = Array.isArray(dados.message) ? dados.message[0] : dados.message;
      return { ok: false, erro: msg ?? 'Não consegui salvar.' };
    }

    return { ok: true, dados };
  } catch {
    return { ok: false, erro: 'O servidor não respondeu.' };
  }
}

/** Sobe uma foto e devolve o endereço dela. */
export async function enviarFoto(arquivo: File): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const form = new FormData();
  form.append('arquivo', arquivo);

  try {
    const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
    const dados = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = Array.isArray(dados.message) ? dados.message[0] : dados.message;
      return { ok: false, erro: msg ?? 'Não consegui enviar a foto.' };
    }

    return { ok: true, url: dados.url };
  } catch {
    return { ok: false, erro: 'O servidor não respondeu.' };
  }
}

/** "R$ 12,50" digitado -> 1250 centavos. */
export function paraCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** 1250 centavos -> "12,50" (para preencher o campo). */
export function paraCampo(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
