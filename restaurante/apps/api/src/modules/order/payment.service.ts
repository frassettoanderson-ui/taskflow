import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../../adapters/payment/payment.port';
import { OrderService } from './order.service';
import { calcularSplit, lerRegras } from './pricing';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly orders: OrderService,
    @Inject(PAYMENT_PROVIDER) private readonly gateway: PaymentProvider,
  ) {}

  /**
   * Cria a cobrança de um pedido e devolve os dados do Pix.
   *
   * É aqui que a divisão do dinheiro (split) é calculada: restaurante,
   * plataforma e motoboy. A plataforma NÃO retém o valor — quem divide é o
   * gateway.
   */
  async criarCobranca(code: string) {
    const cru = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, tenantId: true },
    });
    if (!cru) throw new NotFoundException('Pedido não encontrado.');

    return this.context.runAsTenant(cru.tenantId, async () => {
      const pedido = await this.tenantPrisma.db.order.findUnique({
        where: { id: cru.id },
        include: { payment: true },
      });
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');

      // Já tem cobrança? Devolve a mesma (não cria duas para o mesmo pedido).
      if (pedido.payment) return this.formatar(pedido.payment);

      if (pedido.status !== OrderStatus.AWAITING_PAYMENT) {
        throw new BadRequestException('Este pedido não está aguardando pagamento.');
      }

      const regras = lerRegras();
      const split = calcularSplit({
        source: pedido.source,
        method: 'PIX',
        subtotalCents: pedido.subtotalCents,
        deliveryFeeCents: pedido.deliveryFeeCents,
        regras,
        // Na Etapa 7 estes ids passam a ser os recebedores reais no gateway.
        restauranteExternalId: `restaurant:${pedido.brandId}`,
        plataformaExternalId: 'platform',
      });

      const cobranca = await this.gateway.createCharge({
        tenantId: pedido.tenantId,
        orderId: pedido.id,
        amountCents: pedido.totalCents,
        method: 'PIX',
        splits: split.splits,
      });

      const registro = await this.tenantPrisma.db.payment.create({
        data: {
          tenantId: pedido.tenantId, // idem: a camada de isolamento sobrescreve
          orderId: pedido.id,
          provider: 'fake-pix',
          externalId: cobranca.id,
          method: 'PIX',
          status: PaymentStatus.PENDING,
          amountCents: pedido.totalCents,
          qrCode: cobranca.qrCode,
          qrCodeImage: cobranca.qrCodeImage,
        },
      });

      // O detalhamento da divisão fica no histórico do pedido — é o que vai
      // alimentar o financeiro e o acerto do motoboy mais pra frente.
      await this.orders.registrarEvento(
        pedido.tenantId,
        pedido.brandId,
        pedido.id,
        pedido.code,
        'payment.created',
        { chargeId: cobranca.id, split: split.detalhe },
      );

      return this.formatar(registro);
    });
  }

  /**
   * Processa o aviso de pagamento do gateway.
   *
   * IDEMPOTENTE: guardamos o id do aviso. Se o mesmo chegar de novo (o que
   * acontece o tempo todo com gateways de verdade), a segunda vez não faz nada.
   */
  async processarWebhook(payload: { eventId: string; chargeId: string; status: string }) {
    if (!payload?.eventId || !payload?.chargeId) {
      throw new BadRequestException('Aviso de pagamento incompleto.');
    }

    // 1) Já processamos este aviso antes?
    const jaVisto = await this.prisma.processedWebhook.findUnique({
      where: { provider_eventId: { provider: 'fake-pix', eventId: payload.eventId } },
    });
    if (jaVisto) {
      this.logger.log(`Aviso ${payload.eventId} repetido — ignorado (idempotência).`);
      return { ok: true, repetido: true };
    }

    // 2) Traduzir pelo adaptador.
    const resultado = await this.gateway.handleWebhook(payload);
    if (!resultado) throw new BadRequestException('Aviso de pagamento inválido.');

    // 3) Achar a cobrança (operação de sistema: o gateway não conhece tenants).
    const pagamento = await this.prisma.payment.findUnique({
      where: { externalId: resultado.chargeId },
      include: { order: true },
    });
    if (!pagamento) throw new NotFoundException('Cobrança não encontrada.');

    await this.prisma.processedWebhook.create({
      data: { provider: 'fake-pix', eventId: payload.eventId },
    });

    // Segunda proteção: o aviso é novo, mas a cobrança JÁ estava paga.
    // Gateways de verdade mandam vários avisos diferentes para a mesma
    // cobrança — sem isto, o pedido seria marcado como pago duas vezes.
    if (pagamento.status === PaymentStatus.PAID) {
      this.logger.log(`Cobrança ${resultado.chargeId} já estava paga — nada a fazer.`);
      return { ok: true, repetido: true, status: 'PAID' };
    }

    if (resultado.status !== 'PAID') {
      await this.prisma.payment.update({
        where: { id: pagamento.id },
        data: { status: resultado.status as PaymentStatus },
      });
      return { ok: true, repetido: false, status: resultado.status };
    }

    // 4) Pagamento aprovado: marca como pago e o pedido CAI NA COZINHA.
    return this.context.runAsTenant(pagamento.tenantId, async () => {
      await this.tenantPrisma.db.payment.update({
        where: { id: pagamento.id },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      });

      await this.orders.registrarEvento(
        pagamento.tenantId,
        pagamento.order.brandId,
        pagamento.orderId,
        pagamento.order.code,
        'order.paid',
        { chargeId: resultado.chargeId, amountCents: pagamento.amountCents },
      );

      // Só agora o pedido vira "recebido" e aparece para a cozinha.
      if (pagamento.order.status === OrderStatus.AWAITING_PAYMENT) {
        await this.orders.mudarStatus(pagamento.orderId, OrderStatus.RECEIVED, 'pagamento');
      }

      return { ok: true, repetido: false, status: 'PAID' };
    });
  }

  private formatar(p: {
    externalId: string;
    status: PaymentStatus;
    amountCents: number;
    qrCode: string | null;
    qrCodeImage: string | null;
  }) {
    return {
      chargeId: p.externalId,
      status: p.status,
      amountCents: p.amountCents,
      qrCode: p.qrCode,
      qrCodeImage: p.qrCodeImage,
    };
  }
}
