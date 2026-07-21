import { OrderSource, PaymentMethod } from '@prisma/client';
import { calcularSplit, lerRegras } from './pricing';

const regras = lerRegras({} as NodeJS.ProcessEnv); // usa os valores padrão

function split(source: OrderSource, method: PaymentMethod, subtotal: number, frete: number) {
  return calcularSplit({
    source,
    method,
    subtotalCents: subtotal,
    deliveryFeeCents: frete,
    regras,
    restauranteExternalId: 'r1',
    plataformaExternalId: 'p1',
  });
}

describe('Divisão do dinheiro (split)', () => {
  it('pedido DIRETO no Pix: o consumidor não paga comissão nenhuma', () => {
    const r = split(OrderSource.DIRECT, PaymentMethod.PIX, 10000, 900);

    expect(r.detalhe.comissaoPortalCents).toBe(0); // canal próprio: sem comissão
    expect(r.detalhe.taxaPagamentoCents).toBe(0); // Pix é zero de propósito
    // O restaurante recebe o valor cheio do cardápio.
    expect(r.detalhe.restauranteCents).toBe(10000);
  });

  it('a plataforma fica com 10% do frete e o motoboy com o resto', () => {
    const r = split(OrderSource.DIRECT, PaymentMethod.PIX, 10000, 900);

    expect(r.detalhe.taxaSobreEntregaCents).toBe(90); // 10% de R$ 9,00
    expect(r.detalhe.motoboyCents).toBe(810); // motoboy leva R$ 8,10
  });

  it('pedido do PORTAL tem comissão, e ela sai da plataforma — não do frete', () => {
    const r = split(OrderSource.PORTAL, PaymentMethod.PIX, 10000, 900);

    expect(r.detalhe.comissaoPortalCents).toBe(1200); // 12%
    expect(r.detalhe.restauranteCents).toBe(8800);
    expect(r.detalhe.plataformaCents).toBe(1200 + 90);
  });

  it('no cartão a plataforma cobra o processamento', () => {
    const r = split(OrderSource.DIRECT, PaymentMethod.CARD, 10000, 900);

    // 3,5% sobre o total (10900)
    expect(r.detalhe.taxaPagamentoCents).toBe(382);
    expect(r.detalhe.restauranteCents).toBe(10000 - 382);
  });

  it('a soma das partes SEMPRE fecha com o total — nunca sobra nem falta centavo', () => {
    const casos: Array<[OrderSource, PaymentMethod, number, number]> = [
      [OrderSource.DIRECT, PaymentMethod.PIX, 10000, 900],
      [OrderSource.PORTAL, PaymentMethod.CARD, 7333, 777],
      [OrderSource.DIRECT, PaymentMethod.CARD, 1, 1],
      [OrderSource.PORTAL, PaymentMethod.PIX, 99999, 0],
      [OrderSource.IFOOD, PaymentMethod.CASH, 4567, 1234],
    ];

    for (const [source, method, subtotal, frete] of casos) {
      const r = split(source, method, subtotal, frete);
      const soma = r.splits.reduce((s, x) => s + x.amountCents, 0);
      expect(soma).toBe(r.totalCents);
      expect(r.totalCents).toBe(subtotal + frete);
    }
  });

  it('sem frete, não existe recebedor motoboy', () => {
    const r = split(OrderSource.DIRECT, PaymentMethod.PIX, 5000, 0);
    expect(r.splits.find((s) => s.kind === 'courier')).toBeUndefined();
  });
});
