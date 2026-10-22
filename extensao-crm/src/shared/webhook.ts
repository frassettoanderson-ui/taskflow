// Disparo de webhooks: o content avisa o evento e o service worker faz o POST para as URLs cadastradas.
import type { EventoWebhook } from './dados';

export interface PedidoWebhook {
  tipo: 'webhook';
  evento: EventoWebhook;
  dados: Record<string, unknown>;
}

/** Chamado de qualquer parte da extensão. Não espera resposta nem falha se não houver webhook. */
export function emitirWebhook(evento: EventoWebhook, dados: Record<string, unknown>) {
  try {
    chrome.runtime.sendMessage({ tipo: 'webhook', evento, dados } satisfies PedidoWebhook).catch(() => {});
  } catch {
    // extensão recarregada: o content antigo perde o canal com o background
  }
}
