import type { AcaoIA } from '../shared/ia';

/** Pede um texto à IA (o service worker faz a chamada com a chave salva). */
export async function pedirIA(acao: AcaoIA, texto: string, contexto?: string): Promise<string> {
  const r = await chrome.runtime.sendMessage({ tipo: 'ia', acao, texto, contexto });
  if (!r?.ok) throw new Error(r?.erro ?? 'A IA não respondeu');
  if (!r.texto) throw new Error('A IA devolveu um texto vazio');
  return r.texto as string;
}
