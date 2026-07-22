import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InvoiceStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BILLING_PROVIDER, BillingProvider } from '../../adapters/billing/billing.port';
import { FILAS, QueueService } from '../../queue/queue.service';

/** Dias de teste grátis para quem entra. */
const DIAS_DE_TESTE = Number(process.env.TRIAL_DAYS ?? 14);
/** Dias entre a emissão da fatura e o vencimento. */
const DIAS_ATE_VENCER = Number(process.env.INVOICE_DUE_DAYS ?? 7);

/**
 * A ASSINATURA DO SaaS — como a plataforma se sustenta.
 *
 * A cobrança é POR TENANT, não por marca: quem opera quatro marcas na mesma
 * cozinha não paga quatro vezes. Os limites do plano (nº de marcas, pedidos)
 * é que separam as faixas.
 */
@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fila: QueueService,
    @Inject(BILLING_PROVIDER) private readonly cobrador: BillingProvider,
  ) {}

  async onModuleInit() {
    // A cobrança tem fila própria: assim ela não disputa espaço com as
    // mensagens e um erro aqui não atrasa o resto.
    this.fila.registrarTrabalhador(FILAS.FATURAMENTO, () => this.faturarTodos(), 1);

    // Todo dia 1º, às 4h da manhã, emite as faturas do mês.
    try {
      await this.fila.agendarRepetida(FILAS.FATURAMENTO, 'faturar-assinaturas', {}, '0 4 1 * *');
    } catch (e) {
      this.logger.warn(`Não consegui agendar o faturamento mensal: ${e}`);
    }
  }

  /** Dispara o faturamento agora (usado no teste e pelo painel). */
  async faturarAgora() {
    await this.fila.agendar(FILAS.FATURAMENTO, 'faturar-assinaturas', {});
    return { ok: true, mensagem: 'Faturamento colocado na fila.' };
  }

  /** Os planos disponíveis (catálogo do sistema, igual para todos). */
  listarPlanos() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** A assinatura do restaurante logado. */
  async minhaAssinatura(tenantId: string) {
    const a = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: true,
        invoices: { orderBy: { createdAt: 'desc' }, take: 12 },
      },
    });

    if (!a) return { assinado: false as const };

    const marcas = await this.prisma.brand.count({ where: { tenantId } });

    // Pedidos do mês corrente, para mostrar o consumo contra o limite.
    const inicioDoMes = new Date();
    inicioDoMes.setDate(1);
    inicioDoMes.setHours(0, 0, 0, 0);
    const pedidosNoMes = await this.prisma.order.count({
      where: { tenantId, createdAt: { gte: inicioDoMes }, status: { not: 'CANCELED' } },
    });

    return {
      assinado: true as const,
      plano: {
        code: a.plan.code,
        nome: a.plan.name,
        mensalidadeCents: a.plan.monthlyPriceCents,
        maxMarcas: a.plan.maxBrands,
        maxPedidosPorMes: a.plan.maxOrdersPerMonth,
        recursos: a.plan.features,
      },
      status: a.status,
      emTeste: a.status === SubscriptionStatus.TRIALING,
      testeAte: a.trialEndsAt,
      periodoAtual: { de: a.currentPeriodStart, ate: a.currentPeriodEnd },
      uso: {
        marcas,
        pedidosNoMes,
        limiteMarcas: a.plan.maxBrands,
        limitePedidos: a.plan.maxOrdersPerMonth,
      },
      faturas: a.invoices.map((f) => ({
        id: f.id,
        numero: f.number,
        mensalidadeCents: f.planCents,
        excedenteCents: f.overageCents,
        pedidosExcedentes: f.overageOrders,
        periodo: { de: f.periodFrom, ate: f.periodTo },
        valorCents: f.amountCents,
        status: f.status,
        vencimento: f.dueDate,
        pagoEm: f.paidAt,
      })),
    };
  }

  /** Assina um plano (ou troca). */
  async assinar(tenantId: string, planCode: string) {
    const plano = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plano || !plano.active) throw new NotFoundException('Plano não encontrado.');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');

    const existente = await this.prisma.subscription.findUnique({ where: { tenantId } });

    // ---- troca de plano ----
    if (existente) {
      let externalId = existente.externalId;

      try {
        if (externalId) {
          await this.cobrador.trocarPlano(externalId, plano.code, plano.monthlyPriceCents);
        }
      } catch {
        // O cobrador não conhece esta assinatura. Acontece de verdade: o
        // serviço externo pode ter perdido o registro, ou nós migramos de
        // fornecedor. Em vez de travar o cliente, recriamos lá e seguimos.
        this.logger.warn(
          `Cobrador não conhece a assinatura ${externalId} — recriando para "${tenant.name}".`,
        );
        const nova = await this.cobrador.criarAssinatura({
          tenantId,
          tenantName: tenant.name,
          planCode: plano.code,
          monthlyPriceCents: plano.monthlyPriceCents,
        });
        externalId = nova.id;
      }

      await this.prisma.subscription.update({
        where: { tenantId },
        data: {
          planId: plano.id,
          status: SubscriptionStatus.ACTIVE,
          canceledAt: null,
          externalId,
        },
      });
      return this.minhaAssinatura(tenantId);
    }

    // ---- primeira assinatura ----
    const externa = await this.cobrador.criarAssinatura({
      tenantId,
      tenantName: tenant.name,
      planCode: plano.code,
      monthlyPriceCents: plano.monthlyPriceCents,
      trialDays: DIAS_DE_TESTE,
    });

    const agora = new Date();
    const fimDoTeste = new Date(agora);
    fimDoTeste.setDate(fimDoTeste.getDate() + DIAS_DE_TESTE);
    const fimDoPeriodo = new Date(agora);
    fimDoPeriodo.setMonth(fimDoPeriodo.getMonth() + 1);

    await this.prisma.subscription.create({
      data: {
        tenantId,
        planId: plano.id,
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: fimDoTeste,
        currentPeriodStart: agora,
        currentPeriodEnd: fimDoPeriodo,
        externalId: externa.id,
      },
    });

    this.logger.log(`"${tenant.name}" assinou o plano ${plano.name} (${DIAS_DE_TESTE} dias grátis).`);
    return this.minhaAssinatura(tenantId);
  }

  async cancelar(tenantId: string) {
    const a = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!a) throw new NotFoundException('Nenhuma assinatura para cancelar.');

    if (a.externalId) await this.cobrador.cancelar(a.externalId);

    await this.prisma.subscription.update({
      where: { tenantId },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });

    return { ok: true };
  }

  /**
   * Emite a fatura do mês de UMA assinatura.
   * Idempotente: não emite duas para o mesmo período.
   */
  async emitirFatura(tenantId: string) {
    const a = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!a) throw new NotFoundException('Assinatura não encontrada.');
    if (a.status === SubscriptionStatus.CANCELED) {
      return { emitida: false, motivo: 'assinatura cancelada' };
    }

    const jaTem = await this.prisma.invoice.findFirst({
      where: { tenantId, periodFrom: a.currentPeriodStart, periodTo: a.currentPeriodEnd },
    });
    if (jaTem) return { emitida: false, motivo: 'já existe fatura deste período' };

    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + DIAS_ATE_VENCER);

    // ---- excedente do período ----
    // Decisão do fundador: pedido que passa do limite NÃO é bloqueado — é
    // cobrado. Contamos aqui, na virada do período, para a fatura já sair com
    // as duas linhas separadas e conseguir se explicar sozinha.
    const pedidosNoPeriodo = await this.prisma.order.count({
      where: {
        tenantId,
        createdAt: { gte: a.currentPeriodStart, lte: a.currentPeriodEnd },
        status: { not: 'CANCELED' },
      },
    });

    const excedentes =
      a.plan.maxOrdersPerMonth > 0
        ? Math.max(0, pedidosNoPeriodo - a.plan.maxOrdersPerMonth)
        : 0;
    const excedenteCents = excedentes * a.plan.overagePriceCents;
    const totalCents = a.plan.monthlyPriceCents + excedenteCents;

    const externa = await this.cobrador.emitirFatura({
      subscriptionExternalId: a.externalId ?? 'sem-id',
      amountCents: totalCents,
      periodFrom: a.currentPeriodStart,
      periodTo: a.currentPeriodEnd,
      dueDate: vencimento,
    });

    const numero = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${tenantId.slice(-6).toUpperCase()}`;

    const fatura = await this.prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId: a.id,
        number: numero,
        periodFrom: a.currentPeriodStart,
        periodTo: a.currentPeriodEnd,
        amountCents: totalCents,
        planCents: a.plan.monthlyPriceCents,
        overageCents: excedenteCents,
        overageOrders: excedentes,
        dueDate: vencimento,
        externalId: externa.id,
      },
    });

    // Empurra o período para o mês seguinte.
    const novoInicio = new Date(a.currentPeriodEnd);
    const novoFim = new Date(novoInicio);
    novoFim.setMonth(novoFim.getMonth() + 1);

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        currentPeriodStart: novoInicio,
        currentPeriodEnd: novoFim,
        status: a.status === SubscriptionStatus.TRIALING ? SubscriptionStatus.ACTIVE : a.status,
      },
    });

    this.logger.log(`Fatura ${fatura.number} emitida: ${fatura.amountCents} centavos.`);
    return { emitida: true, fatura };
  }

  /** Emite as faturas de TODO mundo — a tarefa mensal da fila. */
  async faturarTodos() {
    const assinaturas = await this.prisma.subscription.findMany({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] } },
      select: { tenantId: true },
    });

    let emitidas = 0;
    for (const a of assinaturas) {
      try {
        const r = await this.emitirFatura(a.tenantId);
        if (r.emitida) emitidas++;
      } catch (e) {
        this.logger.error(`Falhei ao faturar o tenant ${a.tenantId}: ${e}`);
      }
    }

    this.logger.log(`Faturamento mensal: ${emitidas} de ${assinaturas.length} faturas emitidas.`);
    return { emitidas, total: assinaturas.length };
  }

  /** Marca a fatura como paga (aviso do cobrador). */
  async processarWebhook(payload: { invoiceExternalId: string; status: string }) {
    const r = await this.cobrador.handleWebhook(payload);
    if (!r) throw new BadRequestException('Aviso de cobrança inválido.');

    const fatura = await this.prisma.invoice.findFirst({ where: { externalId: r.invoiceExternalId } });
    if (!fatura) throw new NotFoundException('Fatura não encontrada.');
    if (fatura.status === InvoiceStatus.PAID) return { ok: true, repetido: true };

    await this.prisma.invoice.update({
      where: { id: fatura.id },
      data: {
        status: r.status as InvoiceStatus,
        paidAt: r.status === 'PAID' ? new Date() : null,
      },
    });

    if (r.status === 'PAID') {
      await this.prisma.subscription.update({
        where: { id: fatura.subscriptionId },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    }

    return { ok: true, repetido: false, status: r.status };
  }

}
