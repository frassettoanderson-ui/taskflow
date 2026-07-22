import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InvoiceStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { inicioDoMes } from '../../common/datas';

/**
 * Quantos dias depois do vencimento a conta é cortada.
 *
 * Decisão do fundador: **15 dias**. Configurável por variável de ambiente para
 * não precisar mexer no código se ele mudar de ideia.
 */
export const DIAS_ATE_CORTAR = Number(process.env.BLOQUEIO_APOS_DIAS ?? 15);

/** A partir de quanto do limite o sistema começa a avisar. */
const AVISA_A_PARTIR_DE = 0.8;

/** O que a cobrança causa hoje. Tipado para o resto do código enxergar tudo. */
export type SituacaoDaCobranca = {
  emDia: boolean;
  diasAtrasado: number;
  bloqueado: boolean;
  faturaVencidaCents: number;
  diasAteCortar?: number;
  faturaNumero?: string;
};

@Injectable()
export class LimitesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quanto do plano já foi usado, e o que fazer a respeito.
   *
   * Repare no que este método NÃO faz: ele nunca diz "pare de vender por causa
   * de pedido". Passar do limite de pedidos gera **excedente na fatura**, não
   * bloqueio — travar a venda do cliente é o jeito mais rápido de perdê-lo, e
   * ele culparia o sistema pelo prejuízo do dia.
   */
  async consumo(tenantId: string) {
    const a = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!a) {
      return {
        assinado: false as const,
        marcas: { usado: 0, limite: 0, cheio: false },
        pedidos: { usado: 0, limite: 0, excedente: 0, avisar: false, estourou: false },
        cobranca: {
          emDia: true,
          diasAtrasado: 0,
          bloqueado: false,
          faturaVencidaCents: 0,
        } as SituacaoDaCobranca,
      };
    }

    const marcas = await this.prisma.brand.count({ where: { tenantId } });

    const pedidosNoMes = await this.prisma.order.count({
      where: {
        tenantId,
        createdAt: { gte: inicioDoMes() },
        status: { not: 'CANCELED' },
      },
    });

    // Limite 0 quer dizer "à vontade" — é assim que o plano ilimitado se diz.
    const limiteMarcas = a.plan.maxBrands;
    const limitePedidos = a.plan.maxOrdersPerMonth;

    const excedente = limitePedidos > 0 ? Math.max(0, pedidosNoMes - limitePedidos) : 0;

    return {
      assinado: true as const,
      plano: {
        code: a.plan.code,
        nome: a.plan.name,
        precoExcedenteCents: a.plan.overagePriceCents,
      },
      marcas: {
        usado: marcas,
        limite: limiteMarcas,
        cheio: limiteMarcas > 0 && marcas >= limiteMarcas,
      },
      pedidos: {
        usado: pedidosNoMes,
        limite: limitePedidos,
        excedente,
        excedenteCents: excedente * a.plan.overagePriceCents,
        avisar: limitePedidos > 0 && pedidosNoMes >= limitePedidos * AVISA_A_PARTIR_DE,
        estourou: excedente > 0,
      },
      cobranca: await this.situacaoDaCobranca(tenantId, a.status),
    };
  }

  /**
   * A fatura mais atrasada e o que ela causa.
   *
   * Só a MAIS antiga interessa: é ela que conta os dias de atraso.
   */
  private async situacaoDaCobranca(
    tenantId: string,
    status: SubscriptionStatus,
  ): Promise<SituacaoDaCobranca> {
    const vencida = await this.prisma.invoice.findFirst({
      where: {
        tenantId,
        status: { in: [InvoiceStatus.OPEN, InvoiceStatus.OVERDUE] },
        dueDate: { lt: new Date() },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (!vencida || status === SubscriptionStatus.TRIALING) {
      return { emDia: true, diasAtrasado: 0, bloqueado: false, faturaVencidaCents: 0 };
    }

    const diasAtrasado = Math.floor(
      (Date.now() - vencida.dueDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    return {
      emDia: false,
      diasAtrasado,
      /** Decisão do fundador: corte total a partir do 15º dia de atraso. */
      bloqueado: diasAtrasado >= DIAS_ATE_CORTAR,
      diasAteCortar: Math.max(0, DIAS_ATE_CORTAR - diasAtrasado),
      faturaVencidaCents: vencida.amountCents,
      faturaNumero: vencida.number,
    };
  }

  /**
   * Trava de criação de marca.
   *
   * Aqui bloquear é seguro: criar marca é ato de administração, feito com
   * calma, e a mensagem já ensina o caminho (subir de plano). Nada para de
   * vender por causa disto.
   */
  async exigirPodeCriarMarca(tenantId: string) {
    const c = await this.consumo(tenantId);
    if (!c.assinado) return; // sem assinatura ainda: não atrapalhamos

    if (c.marcas.cheio) {
      throw new BadRequestException(
        `Seu plano ${c.plano?.nome} permite ${c.marcas.limite} marca(s) e você já tem ${c.marcas.usado}. ` +
          'Suba de plano em Portal → Assinatura para criar mais.',
      );
    }
  }

  /**
   * O corte por falta de pagamento.
   *
   * Chamado no começo das rotas do painel e do cardápio público. Fora do
   * alcance dele, de propósito: o login e a própria tela de assinatura — senão
   * o restaurante ficaria sem como pagar o que deve.
   */
  async exigirEmDia(tenantId: string) {
    const c = await this.consumo(tenantId);
    if (!c.cobranca.bloqueado) return;

    throw new ForbiddenException(
      `Sistema bloqueado: a fatura ${c.cobranca.faturaNumero} está vencida há ` +
        `${c.cobranca.diasAtrasado} dias. Regularize em Portal → Assinatura para reativar.`,
    );
  }
}
