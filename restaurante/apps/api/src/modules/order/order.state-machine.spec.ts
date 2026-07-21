import { OrderStatus } from '@prisma/client';
import { estaFinalizado, podeIr, proximoStatus } from './order.state-machine';

describe('Máquina de estados do pedido', () => {
  it('o caminho normal do pedido é permitido', () => {
    expect(podeIr(OrderStatus.AWAITING_PAYMENT, OrderStatus.RECEIVED)).toBe(true);
    expect(podeIr(OrderStatus.RECEIVED, OrderStatus.ACCEPTED)).toBe(true);
    expect(podeIr(OrderStatus.ACCEPTED, OrderStatus.IN_PREPARATION)).toBe(true);
    expect(podeIr(OrderStatus.IN_PREPARATION, OrderStatus.READY)).toBe(true);
    expect(podeIr(OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
    expect(podeIr(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).toBe(true);
  });

  it('não deixa pular etapas', () => {
    expect(podeIr(OrderStatus.RECEIVED, OrderStatus.DELIVERED)).toBe(false);
    expect(podeIr(OrderStatus.ACCEPTED, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
    expect(podeIr(OrderStatus.AWAITING_PAYMENT, OrderStatus.IN_PREPARATION)).toBe(false);
  });

  it('não deixa voltar atrás', () => {
    expect(podeIr(OrderStatus.READY, OrderStatus.IN_PREPARATION)).toBe(false);
    expect(podeIr(OrderStatus.DELIVERED, OrderStatus.READY)).toBe(false);
  });

  it('pedido entregue ou cancelado é ponto final', () => {
    expect(podeIr(OrderStatus.DELIVERED, OrderStatus.CANCELED)).toBe(false);
    expect(podeIr(OrderStatus.CANCELED, OrderStatus.RECEIVED)).toBe(false);
    expect(estaFinalizado(OrderStatus.DELIVERED)).toBe(true);
    expect(estaFinalizado(OrderStatus.CANCELED)).toBe(true);
    expect(estaFinalizado(OrderStatus.READY)).toBe(false);
  });

  it('dá para cancelar enquanto o pedido está em andamento', () => {
    for (const s of [
      OrderStatus.AWAITING_PAYMENT,
      OrderStatus.RECEIVED,
      OrderStatus.ACCEPTED,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY,
      OrderStatus.OUT_FOR_DELIVERY,
    ]) {
      expect(podeIr(s, OrderStatus.CANCELED)).toBe(true);
    }
  });

  it('de "pronto" dá para ir direto a entregue (retirada no balcão)', () => {
    expect(podeIr(OrderStatus.READY, OrderStatus.DELIVERED)).toBe(true);
  });

  it('o botão da cozinha sugere sempre o próximo passo, nunca cancelar', () => {
    expect(proximoStatus(OrderStatus.RECEIVED)).toBe(OrderStatus.ACCEPTED);
    expect(proximoStatus(OrderStatus.READY)).toBe(OrderStatus.OUT_FOR_DELIVERY);
    expect(proximoStatus(OrderStatus.DELIVERED)).toBeNull();
    expect(proximoStatus(OrderStatus.CANCELED)).toBeNull();
  });
});
