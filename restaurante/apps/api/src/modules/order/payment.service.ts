import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, SessionStatus } from '@prisma/client';
import { SalaoService } from '../salao/salao.service';
import { FinanceService } from '../gestao/finance.service';
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
    // O salão precisa do pagamento e o pagamento precisa avisar o salão quando
    // uma parte da conta é quitada. O forwardRef é o jeito do NestJS de deixar
    // dois módulos se conhecerem sem entrar num laço infinito na inicialização.
    @Inject(forwardRef(() => SalaoService)) private readonly salao: SalaoService,
    private readonly financeiro: FinanceService,
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

      // Quem vai receber o dinheiro. Na Etapa 7 estes ids passam a ser os
      // recebedores de verdade cadastrados no gateway.
      const recebedores = {
        restaurante: `restaurant:${pedido.brandId}`,
        plataforma: 'platform',
        motoboy: pedido.deliveryFeeCents > 0 ? 'courier-pool' : undefined,
      };

      const split = calcularSplit({
        source: pedido.source,
        method: 'PIX',
        subtotalCents: pedido.subtotalCents,
        deliveryFeeCents: pedido.deliveryFeeCents,
        // No pedido do portal a comissão já foi embutida item a item.
        portalCommissionCents: pedido.portalMarkupCents || undefined,
        regras,
        restauranteExternalId: recebedores.restaurante,
        plataformaExternalId: recebedores.plataforma,
        motoboyExternalId: recebedores.motoboy,
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

      // A divisão fica GRAVADA no pedido. Antes ela era calculada e esquecida;
      // agora dá para conferir depois quem recebeu o quê — e é exatamente isto
      // que o gateway real vai executar na Etapa 7.
      await this.tenantPrisma.db.orderSplit.upsert({
        where: { orderId: pedido.id },
        update: {},
        create: {
          tenantId: pedido.tenantId,
          orderId: pedido.id,
          totalCents: split.totalCents,
          restaurantCents: split.detalhe.restauranteCents,
          platformCents: split.detalhe.plataformaCents,
          courierCents: split.detalhe.motoboyCents,
          portalCommissionCents: split.detalhe.comissaoPortalCents,
          paymentFeeCents: split.detalhe.taxaPagamentoCents,
          deliveryPlatformFeeCents: split.detalhe.taxaSobreEntregaCents,
          restaurantRecipientId: recebedores.restaurante,
          platformRecipientId: recebedores.plataforma,
          courierRecipientId: recebedores.motoboy,
          provider: 'fake-pix',
        } as any,
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
   * Cria uma cobrança de UMA PARTE da conta da mesa.
   *
   * É isto que permite dividir: cada pessoa gera o seu Pix, e a conta só quita
   * quando a soma fecha. O valor pode ser "o total dividido por N" ou um valor
   * livre ("eu pago só a minha cerveja").
   */
  async criarCobrancaDeSessao(sessionId: string, amountCents: number) {
    const comanda = await this.tenantPrisma.db.tableSession.findUnique({
      where: { id: sessionId },
      include: { payments: true },
    });
    if (!comanda) throw new NotFoundException('Comanda não encontrada.');

    if (comanda.status === SessionStatus.PAID) {
      throw new BadRequestException('Esta conta já foi paga.');
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BadRequestException('Informe um valor válido.');
    }

    // Quanto ainda falta, contando o que já foi pago E o que está reservado
    // em cobranças ainda pendentes (senão daria para gerar Pix demais).
    const jaPago = comanda.payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.amountCents, 0);
    const pendente = comanda.payments
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((s, p) => s + p.amountCents, 0);

    const disponivel = comanda.totalCents - jaPago - pendente;
    if (amountCents > disponivel) {
      throw new BadRequestException(
        `Só falta ${(Math.max(0, disponivel) / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })} para fechar esta conta.`,
      );
    }

    const regras = lerRegras();
    const split = calcularSplit({
      source: 'DIRECT', // mesa é canal próprio: sem comissão de consumidor
      method: 'PIX',
      subtotalCents: amountCents,
      deliveryFeeCents: 0, // não há entrega no salão
      regras,
      restauranteExternalId: `restaurant:${comanda.brandId}`,
      plataformaExternalId: 'platform',
    });

    const cobranca = await this.gateway.createCharge({
      tenantId: comanda.tenantId,
      orderId: comanda.code, // no salão a referência é a comanda
      amountCents,
      method: 'PIX',
      splits: split.splits,
    });

    const registro = await this.tenantPrisma.db.payment.create({
      data: {
        tenantId: comanda.tenantId,
        tableSessionId: comanda.id,
        provider: 'fake-pix',
        externalId: cobranca.id,
        method: 'PIX',
        status: PaymentStatus.PENDING,
        amountCents,
        qrCode: cobranca.qrCode,
      },
    });

    return {
      chargeId: registro.externalId,
      status: registro.status,
      amountCents: registro.amountCents,
      qrCode: registro.qrCode,
    };
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

    // 4) Pagamento aprovado.
    return this.context.runAsTenant(pagamento.tenantId, async () => {
      await this.tenantPrisma.db.payment.update({
        where: { id: pagamento.id },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      });

      // ---- pagamento de MESA: abate na conta e, se quitou, libera a mesa ----
      if (pagamento.tableSessionId) {
        const r = await this.salao.registrarPagamento(pagamento.tableSessionId);
        this.logger.log(
          r.quitada
            ? `Comanda ${pagamento.tableSessionId} quitada — mesa liberada.`
            : `Comanda ${pagamento.tableSessionId}: ainda faltam ${r.faltaCents} centavos.`,
        );
        return { ok: true, repetido: false, status: 'PAID', ...r };
      }

      // O dinheiro entrou: vira lançamento no financeiro.
      try {
        if (pagamento.orderId) await this.financeiro.registrarVenda(pagamento.orderId);
      } catch (e) {
        this.logger.error(`Falhei ao lançar a venda no financeiro: ${e}`);
      }

      // ---- pagamento de PEDIDO (delivery): cai na cozinha ----
      const pedido = pagamento.order;
      if (!pedido || !pagamento.orderId) {
        return { ok: true, repetido: false, status: 'PAID' };
      }
      const orderId = pagamento.orderId;

      await this.orders.registrarEvento(
        pagamento.tenantId,
        pedido.brandId,
        orderId,
        pedido.code,
        'order.paid',
        { chargeId: resultado.chargeId, amountCents: pagamento.amountCents },
      );

      // Só agora o pedido vira "recebido" e aparece para a cozinha.
      if (pedido.status === OrderStatus.AWAITING_PAYMENT) {
        await this.orders.mudarStatus(orderId, OrderStatus.RECEIVED, 'pagamento');
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
