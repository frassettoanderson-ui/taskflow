import { OrderSource, PaymentMethod } from '@prisma/client';
import { SplitRecipient } from '../../adapters/payment/payment.port';

/**
 * AS CONTAS DO DINHEIRO.
 *
 * Tudo em CENTAVOS e em "bps" (pontos-base). bps é só um jeito de escrever
 * porcentagem sem vírgula: 100 bps = 1%, 1000 bps = 10%, 350 bps = 3,5%.
 * Usamos assim porque número com vírgula erra centavo na conta.
 *
 * TODOS os valores abaixo vêm de configuração — nenhum número fixo no código.
 */
export interface RegrasDeCobranca {
  /** Frete cobrado do consumidor (por enquanto fixo — o cálculo real usa o MapProvider). */
  taxaEntregaCents: number;
  /** Quanto a plataforma cobra de "processamento" no Pix. */
  taxaPixBps: number;
  /** Quanto a plataforma cobra de "processamento" no cartão. */
  taxaCartaoBps: number;
  /** Comissão do PORTAL — só incide em pedido que o portal descobriu. */
  comissaoPortalBps: number;
  /** Quanto a plataforma retém da taxa de entrega (o motoboy fica com o resto). */
  taxaSobreEntregaBps: number;
}

export function lerRegras(env: NodeJS.ProcessEnv = process.env): RegrasDeCobranca {
  const num = (chave: string, padrao: number) => {
    const v = Number(env[chave]);
    return Number.isFinite(v) ? v : padrao;
  };

  return {
    taxaEntregaCents: num('DELIVERY_FEE_CENTS', 900), // R$ 9,00
    taxaPixBps: num('PLATFORM_PIX_FEE_BPS', 0), // 0% — Pix é o barato de propósito
    taxaCartaoBps: num('PLATFORM_CARD_FEE_BPS', 350), // 3,5%
    comissaoPortalBps: num('PORTAL_COMMISSION_BPS', 1200), // 12%
    taxaSobreEntregaBps: num('COURIER_PLATFORM_FEE_BPS', 1000), // 10% do frete
  };
}

/** Aplica uma porcentagem em bps sobre um valor em centavos. */
function aplicarBps(valorCents: number, bps: number): number {
  return Math.round((valorCents * bps) / 10000);
}

export interface EntradaDoSplit {
  source: OrderSource;
  method: PaymentMethod;
  subtotalCents: number;
  deliveryFeeCents: number;
  regras: RegrasDeCobranca;
  /**
   * A comissão do portal JÁ CALCULADA, quando o preço foi marcado item a item.
   * Preferimos este valor ao cálculo por porcentagem porque o arredondamento
   * de cada item já aconteceu — usar a porcentagem de novo daria diferença de
   * centavos entre o que o cliente pagou e o que foi dividido.
   */
  portalCommissionCents?: number;
  /** Identificadores no gateway (hoje são fakes). */
  restauranteExternalId: string;
  plataformaExternalId: string;
  motoboyExternalId?: string;
}

export interface ResultadoDoSplit {
  totalCents: number;
  splits: SplitRecipient[];
  /** Detalhamento, para aparecer no histórico do pedido e nos relatórios. */
  detalhe: {
    comissaoPortalCents: number;
    taxaPagamentoCents: number;
    taxaSobreEntregaCents: number;
    restauranteCents: number;
    motoboyCents: number;
    plataformaCents: number;
  };
}

/**
 * Divide o dinheiro entre restaurante, plataforma e motoboy.
 *
 * Regras do modelo de negócio (CLAUDE.md):
 *  - Pedido DIRETO (canal próprio) NÃO tem comissão de consumidor. Ponto.
 *  - Pedido do PORTAL tem comissão embutida no preço: o restaurante recebe o
 *    valor cheio do cardápio dele, e a plataforma fica com o acréscimo.
 *  - A plataforma cobra "processamento" conforme a forma de pagamento
 *    (cheio no cartão, zero no Pix).
 *  - Da taxa de entrega, a plataforma retém uma fatia; o motoboy leva o resto.
 */
export function calcularSplit(entrada: EntradaDoSplit): ResultadoDoSplit {
  const { subtotalCents, deliveryFeeCents, regras } = entrada;
  const totalCents = subtotalCents + deliveryFeeCents;

  // 1) Comissão do portal — zero quando o pedido veio do canal direto.
  //    Se o preço já veio marcado item a item, usamos o valor exato.
  const comissaoPortalCents =
    entrada.source === OrderSource.PORTAL
      ? (entrada.portalCommissionCents ?? aplicarBps(subtotalCents, regras.comissaoPortalBps))
      : 0;

  // 2) Taxa de processamento, conforme a forma de pagamento.
  const bpsPagamento =
    entrada.method === PaymentMethod.CARD
      ? regras.taxaCartaoBps
      : entrada.method === PaymentMethod.PIX
        ? regras.taxaPixBps
        : 0; // dinheiro não passa por gateway
  const taxaPagamentoCents = aplicarBps(totalCents, bpsPagamento);

  // 3) Fatia da plataforma sobre o frete (o motoboy fica com o restante).
  const taxaSobreEntregaCents = aplicarBps(deliveryFeeCents, regras.taxaSobreEntregaBps);
  const motoboyCents = deliveryFeeCents - taxaSobreEntregaCents;

  const plataformaCents = comissaoPortalCents + taxaPagamentoCents + taxaSobreEntregaCents;

  // O restaurante recebe o que sobra. Fazer por subtração garante que a soma
  // bate exatamente com o total, sem centavo perdido no arredondamento.
  const restauranteCents = totalCents - plataformaCents - motoboyCents;

  const splits: SplitRecipient[] = [
    {
      kind: 'restaurant',
      externalId: entrada.restauranteExternalId,
      amountCents: restauranteCents,
    },
    { kind: 'platform', externalId: entrada.plataformaExternalId, amountCents: plataformaCents },
  ];

  if (motoboyCents > 0) {
    splits.push({
      kind: 'courier',
      externalId: entrada.motoboyExternalId ?? 'courier-pool',
      amountCents: motoboyCents,
    });
  }

  return {
    totalCents,
    splits,
    detalhe: {
      comissaoPortalCents,
      taxaPagamentoCents,
      taxaSobreEntregaCents,
      restauranteCents,
      motoboyCents,
      plataformaCents,
    },
  };
}
