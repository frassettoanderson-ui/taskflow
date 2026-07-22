import { Injectable, Logger } from '@nestjs/common';
import { CouponType, CustomerSegment, MessageKind } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { MessagingService } from '../marketing/messaging.service';

/** Quantos dias o cupom de graduação vale. */
const VALIDADE_DIAS = Number(process.env.GRADUATION_COUPON_DAYS ?? 30);

function dinheiro(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * O FUNIL DE GRADUAÇÃO — o que diferencia este portal de um iFood.
 *
 * A ideia, em português: o portal existe para APRESENTAR o restaurante a um
 * cliente novo. Feita a apresentação, o interesse de todo mundo (menos o do
 * marketplace tradicional) é que o próximo pedido venha pelo canal direto:
 *
 *   - o cliente paga menos, porque não tem comissão embutida;
 *   - o restaurante recebe igual e não paga comissão nenhuma;
 *   - a plataforma ganha na assinatura, não no pedágio.
 *
 * Por isso, todo pedido do portal gera um cupom do canal direto daquela marca
 * e mostra ao cliente, em reais, quanto ele teria economizado.
 */
@Injectable()
export class GraduationService {
  private readonly logger = new Logger(GraduationService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly carteiro: MessagingService,
  ) {}

  /**
   * Gera o incentivo do pedido do portal.
   *
   * O cupom é do CANAL DIRETO da marca e o desconto equivale à comissão que o
   * cliente pagou por ter vindo pelo portal — ou seja, na próxima ele paga o
   * mesmo que pagaria hoje, mas o dinheiro fica com o restaurante.
   */
  async gerarIncentivo(dados: {
    tenantId: string;
    brandId: string;
    brandName: string;
    brandSlug: string;
    orderId: string;
    orderCode: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    /** quanto de comissão o cliente pagou neste pedido */
    economiaCents: number;
  }) {
    if (dados.economiaCents <= 0) return { gerado: false, motivo: 'sem comissão neste pedido' };

    return this.context.runAsTenant(dados.tenantId, async () => {
      const code = `DIRETO${dados.orderCode}`;

      const vence = new Date();
      vence.setDate(vence.getDate() + VALIDADE_DIAS);

      // O cupom só vale no canal direto — no portal ele não aparece.
      await this.tenantPrisma.db.coupon.upsert({
        where: { brandId_code: { brandId: dados.brandId, code } },
        update: {},
        create: {
          brandId: dados.brandId,
          code,
          description: `Você conheceu a ${dados.brandName} pelo portal — peça direto e economize`,
          type: CouponType.FIXED,
          value: dados.economiaCents,
          minOrderCents: 0,
          segment: CustomerSegment.ALL,
          usageLimit: 1,
          usageLimitPerCustomer: 1,
          validUntil: vence,
        } as any,
      });

      await this.tenantPrisma.db.order.update({
        where: { id: dados.orderId },
        data: { graduationCouponCode: code },
      });

      // E avisamos o cliente, com a conta na cara.
      const primeiroNome = dados.customerName.split(' ')[0];
      const texto =
        `${primeiroNome}, obrigado por pedir na ${dados.brandName}! 🍽️\n\n` +
        `Da próxima vez peça direto com a gente e economize: ` +
        `neste pedido você pagou ${dinheiro(dados.economiaCents)} a mais por ter vindo pelo portal.\n\n` +
        `Use o cupom ${code} em /m/${dados.brandSlug} — vale ${VALIDADE_DIAS} dias.`;

      await this.carteiro.enfileirar({
        tenantId: dados.tenantId,
        brandId: dados.brandId,
        customerId: dados.customerId,
        kind: MessageKind.CAMPAIGN,
        to: dados.customerPhone,
        body: texto,
      });

      this.logger.log(
        `Funil de graduação: cupom ${code} (${dados.economiaCents} centavos) para o pedido ${dados.orderCode}.`,
      );

      return {
        gerado: true,
        cupom: code,
        economiaCents: dados.economiaCents,
        validoAte: vence,
        linkDireto: `/m/${dados.brandSlug}`,
      };
    });
  }
}
