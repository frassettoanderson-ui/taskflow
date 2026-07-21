import { OrderStatus } from '@prisma/client';

/**
 * A MÁQUINA DE ESTADOS DO PEDIDO.
 *
 * Diz, para cada situação, quais são as próximas situações permitidas.
 * Isso impede bobagem: um pedido não pode pular de "recebido" direto para
 * "entregue", nem voltar de "entregue" para "em preparo".
 *
 *   aguardando pagamento
 *          ↓
 *      recebido → aceito → em preparo → pronto → saiu p/ entrega → entregue
 *          └───────────── cancelado ─────────────┘
 */
export const TRANSICOES: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.RECEIVED, OrderStatus.CANCELED],
  [OrderStatus.RECEIVED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELED],
  [OrderStatus.ACCEPTED]: [OrderStatus.IN_PREPARATION, OrderStatus.CANCELED],
  [OrderStatus.IN_PREPARATION]: [OrderStatus.READY, OrderStatus.CANCELED],
  // De "pronto" dá para ir para entrega OU direto para entregue (caso de retirada no balcão).
  [OrderStatus.READY]: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELED],
  // Fim da linha: não sai mais daqui.
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELED]: [],
};

/** Esta mudança de situação é permitida? */
export function podeIr(de: OrderStatus, para: OrderStatus): boolean {
  return TRANSICOES[de].includes(para);
}

/** O "próximo passo natural" — é o que o botão da tela da cozinha usa. */
export function proximoStatus(atual: OrderStatus): OrderStatus | null {
  const caminho = TRANSICOES[atual].filter((s) => s !== OrderStatus.CANCELED);
  return caminho[0] ?? null;
}

/** Já acabou (não aparece mais na tela da cozinha)? */
export function estaFinalizado(status: OrderStatus): boolean {
  return status === OrderStatus.DELIVERED || status === OrderStatus.CANCELED;
}

/** Nomes em português, usados nas telas e nas mensagens. */
export const NOME_DO_STATUS: Record<OrderStatus, string> = {
  [OrderStatus.AWAITING_PAYMENT]: 'Aguardando pagamento',
  [OrderStatus.RECEIVED]: 'Recebido',
  [OrderStatus.ACCEPTED]: 'Aceito',
  [OrderStatus.IN_PREPARATION]: 'Em preparo',
  [OrderStatus.READY]: 'Pronto',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Saiu para entrega',
  [OrderStatus.DELIVERED]: 'Entregue',
  [OrderStatus.CANCELED]: 'Cancelado',
};
