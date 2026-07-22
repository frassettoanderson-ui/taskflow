import { BadRequestException } from '@nestjs/common';
import { SalesChannel } from '@prisma/client';
import { lerCanal, NOME_DO_CANAL, APELIDO_DO_CANAL } from './channel';

describe('Canal de venda', () => {
  it('sem canal informado, assume delivery', () => {
    expect(lerCanal()).toBe(SalesChannel.DELIVERY);
    expect(lerCanal('')).toBe(SalesChannel.DELIVERY);
  });

  it('entende os apelidos usados no endereço do site', () => {
    expect(lerCanal('delivery')).toBe(SalesChannel.DELIVERY);
    expect(lerCanal('salao')).toBe(SalesChannel.DINE_IN);
    expect(lerCanal('salão')).toBe(SalesChannel.DINE_IN);
    expect(lerCanal('balcao')).toBe(SalesChannel.COUNTER);
    expect(lerCanal('BALCÃO')).toBe(SalesChannel.COUNTER);
    expect(lerCanal('retirada')).toBe(SalesChannel.COUNTER);
  });

  it('canal inventado é recusado com mensagem clara', () => {
    expect(() => lerCanal('drive-thru')).toThrow(BadRequestException);
    try {
      lerCanal('drive-thru');
    } catch (e: any) {
      expect(e.message).toContain('delivery, salao ou balcao');
    }
  });

  it('ida e volta entre apelido e canal fecha', () => {
    for (const canal of Object.values(SalesChannel)) {
      expect(lerCanal(APELIDO_DO_CANAL[canal])).toBe(canal);
      expect(NOME_DO_CANAL[canal]).toBeTruthy();
    }
  });
});
