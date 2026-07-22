import { OrderSource, PaymentMethod } from '@prisma/client';
import { comissaoEmbutida, precoDoPortal } from './portal.service';
import { calcularSplit, lerRegras } from '../order/pricing';

const regras = lerRegras({} as NodeJS.ProcessEnv);

describe('Preço do portal (comissão embutida)', () => {
  it('12% sobre R$ 46,90 dá R$ 52,53', () => {
    expect(precoDoPortal(4690, 1200)).toBe(5253);
  });

  it('a comissão é a diferença entre os dois preços', () => {
    const noPortal = precoDoPortal(4690, 1200);
    expect(comissaoEmbutida(noPortal, 4690)).toBe(563);
  });

  it('sem comissão, o preço do portal é o mesmo do cardápio', () => {
    expect(precoDoPortal(4690, 0)).toBe(4690);
    expect(comissaoEmbutida(4690, 4690)).toBe(0);
  });

  it('arredonda para o centavo, sem casa decimal perdida', () => {
    // 12% de R$ 33,33 = R$ 37,3296 -> R$ 37,33
    expect(precoDoPortal(3333, 1200)).toBe(3733);
  });

  it('comissão configurável: 20% em vez de 12%', () => {
    expect(precoDoPortal(10000, 2000)).toBe(12000);
  });
});

describe('Split de 3 lados no pedido do portal', () => {
  function split(portalCommissionCents?: number) {
    return calcularSplit({
      source: OrderSource.PORTAL,
      method: PaymentMethod.PIX,
      subtotalCents: 10506, // preço do portal
      deliveryFeeCents: 700,
      portalCommissionCents,
      regras,
      restauranteExternalId: 'r',
      plataformaExternalId: 'p',
      motoboyExternalId: 'c',
    });
  }

  it('o restaurante recebe o valor CHEIO do cardápio dele', () => {
    // R$ 105,06 no portal, dos quais R$ 11,26 são comissão
    const r = split(1126);
    expect(r.detalhe.restauranteCents).toBe(10506 - 1126);
  });

  it('a comissão do portal fica com a plataforma', () => {
    const r = split(1126);
    expect(r.detalhe.comissaoPortalCents).toBe(1126);
    expect(r.detalhe.plataformaCents).toBeGreaterThanOrEqual(1126);
  });

  it('o motoboy leva o frete menos a fatia da plataforma', () => {
    const r = split(1126);
    expect(r.detalhe.taxaSobreEntregaCents).toBe(70); // 10% de R$ 7,00
    expect(r.detalhe.motoboyCents).toBe(630);
  });

  it('a soma dos três lados fecha exatamente com o total', () => {
    const r = split(1126);
    const soma = r.splits.reduce((s, x) => s + x.amountCents, 0);
    expect(soma).toBe(r.totalCents);
    expect(r.totalCents).toBe(10506 + 700);
  });

  it('sem a comissão exata, cai no cálculo por porcentagem', () => {
    const r = split(undefined);
    // 12% de R$ 105,06
    expect(r.detalhe.comissaoPortalCents).toBe(1261);
  });

  it('pedido DIRETO não tem comissão nenhuma, mesmo passando o valor', () => {
    const r = calcularSplit({
      source: OrderSource.DIRECT,
      method: PaymentMethod.PIX,
      subtotalCents: 10506,
      deliveryFeeCents: 700,
      portalCommissionCents: 1126, // ignorado: não veio do portal
      regras,
      restauranteExternalId: 'r',
      plataformaExternalId: 'p',
    });
    expect(r.detalhe.comissaoPortalCents).toBe(0);
    expect(r.detalhe.restauranteCents).toBe(10506);
  });
});

describe('O que o cliente economiza pedindo direto', () => {
  it('a economia é exatamente a comissão que ele pagou', () => {
    const precoDireto = 4690;
    const noPortal = precoDoPortal(precoDireto, 1200);
    const quantidade = 2;

    const totalPortal = noPortal * quantidade;
    const totalDireto = precoDireto * quantidade;

    expect(totalPortal - totalDireto).toBe(comissaoEmbutida(noPortal, precoDireto) * quantidade);
  });
});
