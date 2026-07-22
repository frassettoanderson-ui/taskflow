import { BadRequestException } from '@nestjs/common';
import { SalesChannel } from '@prisma/client';

/**
 * Tradução entre o nome bonito que aparece no endereço do site e o nome
 * técnico do banco. Assim o cliente vê "?canal=salao" em vez de "DINE_IN".
 */
const APELIDOS: Record<string, SalesChannel> = {
  delivery: SalesChannel.DELIVERY,
  entrega: SalesChannel.DELIVERY,
  salao: SalesChannel.DINE_IN,
  mesa: SalesChannel.DINE_IN,
  balcao: SalesChannel.COUNTER,
  retirada: SalesChannel.COUNTER,
};

export const NOME_DO_CANAL: Record<SalesChannel, string> = {
  [SalesChannel.DELIVERY]: 'Delivery',
  [SalesChannel.DINE_IN]: 'Salão',
  [SalesChannel.COUNTER]: 'Balcão',
};

/** Apelido curto usado nos endereços do site. */
export const APELIDO_DO_CANAL: Record<SalesChannel, string> = {
  [SalesChannel.DELIVERY]: 'delivery',
  [SalesChannel.DINE_IN]: 'salao',
  [SalesChannel.COUNTER]: 'balcao',
};

/** Lê o canal do endereço. Sem nada informado, assume delivery. */
export function lerCanal(texto?: string): SalesChannel {
  if (!texto) return SalesChannel.DELIVERY;

  const chave = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

  const canal = APELIDOS[chave];
  if (!canal) {
    throw new BadRequestException(
      `Canal "${texto}" não existe. Use: delivery, salao ou balcao.`,
    );
  }
  return canal;
}
