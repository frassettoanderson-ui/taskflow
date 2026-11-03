import { OrderStatus, SalesChannel } from '@prisma/client';

/**
 * A MÁQUINA DE ESTADOS DO PEDIDO.
 *
 * Diz, para cada situação, quais são as próximas situações permitidas.
 * Isso impede bobagem: um pedido não pode pular de "aguardando" direto para
 * "entregue", nem voltar de "entregue" para "em preparo".
 *
 *   aguardando → aceito → em preparo → pronto → saiu p/ entrega → entregue/finalizado
 *        └────────────────────── cancelado ──────────────────────┘
 *
 * IMPORTANTE: o PAGAMENTO não está nesta linha. Antes existia um estado
 * "aguardando pagamento" que prendia o pedido fora da cozinha até pagar. Agora
 * pagamento e andamento são coisas separadas: o pedido anda pelas etapas
 * independentemente, e se pagou ou não é uma ETIQUETA à parte (Em aberto/Pago).
 */
export const TRANSICOES: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.RECEIVED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELED],
  [OrderStatus.ACCEPTED]: [OrderStatus.IN_PREPARATION, OrderStatus.CANCELED],
  [OrderStatus.IN_PREPARATION]: [OrderStatus.READY, OrderStatus.CANCELED],
  // De "pronto" dá para ir para entrega OU direto para finalizado (retirada/balcão).
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
  [OrderStatus.RECEIVED]: 'Aguardando',
  [OrderStatus.ACCEPTED]: 'Aceito',
  [OrderStatus.IN_PREPARATION]: 'Em preparo',
  [OrderStatus.READY]: 'Pronto',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Saiu para entrega',
  [OrderStatus.DELIVERED]: 'Entregue',
  [OrderStatus.CANCELED]: 'Cancelado',
};

/**
 * O rótulo mostrado ao usuário. A ÚLTIMA etapa muda de nome conforme o canal:
 * "Entregue" no delivery (o entregador levou), "Finalizado" em mesa e balcão
 * (não há o que entregar — a comanda foi encerrada). O resto é igual para todos.
 */
export function rotuloDoStatus(status: OrderStatus, channel?: SalesChannel | null): string {
  if (status === OrderStatus.DELIVERED && channel && channel !== SalesChannel.DELIVERY) {
    return 'Finalizado';
  }
  return NOME_DO_STATUS[status];
}
