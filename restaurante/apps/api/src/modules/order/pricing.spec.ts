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


describe('Carteira da rede: quem banca o desconto é o PORTAL', () => {
  /**
   * O caso real: pedido de R$ 45,09 no portal (R$ 39,09 de comida com R$ 4,19
   * de comissão embutida + R$ 6,00 de frete), com R$ 20,00 pagos da carteira.
   *
   * O que TEM que acontecer: o restaurante receber os R$ 34,90 do cardápio
   * dele, inteiros. Se o desconto do portal encolhesse a parte do restaurante,
   * o portal estaria fazendo promoção com o dinheiro dos outros — e a promessa
   * do produto ("o restaurante recebe cheio") viraria mentira.
   */
  const base = {
    source: OrderSource.PORTAL,
    method: PaymentMethod.PIX,
    subtotalCents: 3909,
    deliveryFeeCents: 600,
    portalCommissionCents: 419,
    regras: lerRegras({} as NodeJS.ProcessEnv),
    restauranteExternalId: 'restaurant:x',
    plataformaExternalId: 'platform',
  };

  it('sem carteira: a plataforma fica com a comissão e a fatia do frete', () => {
    const r = calcularSplit(base);
    expect(r.detalhe.restauranteCents).toBe(3490); // preço cheio do cardápio
    expect(r.detalhe.plataformaCents).toBe(419 + 60);
    expect(r.detalhe.motoboyCents).toBe(540);
  });

  it('com R$ 20 da carteira, o restaurante continua recebendo os R$ 34,90', () => {
    const r = calcularSplit({ ...base, descontoDaPlataformaCents: 2000 });
    expect(r.detalhe.restauranteCents).toBe(3490);
  });

  it('a plataforma fica NEGATIVA — ela pagou para trazer o cliente', () => {
    const r = calcularSplit({ ...base, descontoDaPlataformaCents: 2000 });
    expect(r.detalhe.plataformaCents).toBe(419 + 60 - 2000);
    expect(r.detalhe.plataformaCents).toBeLessThan(0);
  });

  it('a soma das partes é exatamente o que o cliente pagou', () => {
    const r = calcularSplit({ ...base, descontoDaPlataformaCents: 2000 });
    const soma = r.splits.reduce((s, p) => s + p.amountCents, 0);
    expect(soma).toBe(4509 - 2000); // R$ 25,09
  });

  it('no canal direto não há desconto de portal para bancar', () => {
    const r = calcularSplit({ ...base, source: OrderSource.DIRECT, portalCommissionCents: undefined });
    expect(r.detalhe.comissaoPortalCents).toBe(0);
    expect(r.detalhe.descontoDaPlataformaCents).toBe(0);
  });
});
