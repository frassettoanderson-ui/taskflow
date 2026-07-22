import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CashbackEntryType, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

/** Só dígitos — o telefone é a chave do cliente. */
export function limparTelefone(t: string) {
  return (t ?? '').replace(/\D/g, '');
}

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
  ) {}

  /** As regras de cashback da marca (ou nada, se a marca não tem programa). */
  async programa(brandId: string) {
    const p = await this.tenantPrisma.db.loyaltyProgram.findUnique({ where: { brandId } });
    return p?.active ? p : null;
  }

  /**
   * Recalcula o saldo somando o extrato e guarda no cliente.
   *
   * O saldo é sempre DERIVADO do extrato — nunca somamos "à mão" num campo.
   * Assim, se alguma coisa der errado no meio, o extrato continua sendo a
   * verdade e o saldo se conserta sozinho na próxima passada.
   */
  private async recalcularSaldo(customerId: string) {
    const soma = await this.tenantPrisma.db.cashbackEntry.aggregate({
      where: { customerId },
      _sum: { amountCents: true },
    });
    const saldo = Math.max(0, soma._sum.amountCents ?? 0);

    await this.tenantPrisma.db.tenantCustomer.update({
      where: { id: customerId },
      data: { cashbackBalanceCents: saldo },
    });

    return saldo;
  }

  /**
   * Quanto este telefone tem de cashback NESTA marca, e quanto dele pode ser
   * usado num pedido de determinado valor.
   *
   * ⚠️ PONTA SOLTA ASSUMIDA: identificamos o cliente só pelo telefone, sem
   * confirmação. Quem souber o telefone de outra pessoa consegue gastar o
   * cashback dela. O código por WhatsApp resolve isso na Etapa 7.
   */
  async consultarPorTelefone(brandSlug: string, telefone: string, subtotalCents = 0) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: brandSlug },
      select: { id: true, tenantId: true },
    });
    if (!brand) throw new NotFoundException('Restaurante não encontrado.');

    return this.context.runAsTenant(brand.tenantId, async () => {
      const programa = await this.programa(brand.id);
      if (!programa) return { temPrograma: false, saldoCents: 0, maxUsavelCents: 0 };

      const phone = limparTelefone(telefone);
      const cliente = await this.tenantPrisma.db.tenantCustomer.findFirst({
        where: { brandId: brand.id, phone },
        select: { id: true, name: true, cashbackBalanceCents: true },
      });

      const saldo = cliente?.cashbackBalanceCents ?? 0;

      return {
        temPrograma: true,
        // O NOME não sai daqui. Esta rota é pública e responde a qualquer
        // telefone digitado: devolver o nome transformaria o checkout numa
        // agenda de "quem é esse número". O saldo fica, porque sem ele o
        // cliente não teria motivo para pedir o código de confirmação.
        saldoCents: saldo,
        /** o teto de uso: nunca mais do que X% do pedido */
        maxUsavelCents: Math.min(
          saldo,
          Math.floor((subtotalCents * programa.maxRedeemBps) / 10000),
        ),
        percentualDeVolta: programa.cashbackBps / 100,
        maxRedeemPercentual: programa.maxRedeemBps / 100,
        validadeDias: programa.expiresInDays,
      };
    });
  }

  /**
   * Quanto deste pedido pode ser pago com o cashback do cliente.
   * Chamado na hora de fechar o pedido, para conferir o que veio da tela.
   */
  async quantoPodeUsar(brandId: string, customerId: string, subtotalCents: number) {
    const programa = await this.programa(brandId);
    if (!programa) return 0;

    const cliente = await this.tenantPrisma.db.tenantCustomer.findUnique({
      where: { id: customerId },
      select: { cashbackBalanceCents: true },
    });

    const teto = Math.floor((subtotalCents * programa.maxRedeemBps) / 10000);
    return Math.max(0, Math.min(cliente?.cashbackBalanceCents ?? 0, teto));
  }

  /** Debita o cashback usado num pedido. */
  async registrarResgate(customerId: string, orderId: string, amountCents: number) {
    if (amountCents <= 0) return 0;

    await this.tenantPrisma.db.cashbackEntry.create({
      data: {
        customerId,
        orderId,
        type: CashbackEntryType.REDEEM,
        amountCents: -Math.abs(amountCents), // sai do saldo
        description: 'Usado no pedido',
      } as any,
    });

    await this.recalcularSaldo(customerId);
    return amountCents;
  }

  /**
   * Credita o cashback de um pedido ENTREGUE.
   *
   * É idempotente: se rodar duas vezes para o mesmo pedido, a segunda não
   * credita de novo (a fila pode repetir a tarefa).
   */
  async creditarPorPedido(orderId: string) {
    const pedido = await this.tenantPrisma.db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        brandId: true,
        customerId: true,
        subtotalCents: true,
        discountCents: true,
        cashbackRedeemedCents: true,
        status: true,
      },
    });

    if (!pedido || !pedido.customerId) return { creditado: 0, motivo: 'pedido sem cliente' };
    if (pedido.status !== OrderStatus.DELIVERED) {
      return { creditado: 0, motivo: 'pedido ainda não foi entregue' };
    }

    const jaTem = await this.tenantPrisma.db.cashbackEntry.findFirst({
      where: { orderId, type: CashbackEntryType.EARN },
    });
    if (jaTem) return { creditado: 0, motivo: 'já creditado' };

    const programa = await this.programa(pedido.brandId);
    if (!programa) return { creditado: 0, motivo: 'marca sem programa de cashback' };

    // A base do cashback é o que o cliente REALMENTE pagou de comida:
    // sem frete, sem o desconto do cupom e sem a parte paga com cashback.
    const base = Math.max(
      0,
      pedido.subtotalCents - pedido.discountCents - pedido.cashbackRedeemedCents,
    );

    if (base < programa.minOrderCents) {
      return { creditado: 0, motivo: `pedido abaixo do mínimo de ${programa.minOrderCents}` };
    }

    const valor = Math.round((base * programa.cashbackBps) / 10000);
    if (valor <= 0) return { creditado: 0, motivo: 'valor calculado ficou zero' };

    const vence = new Date();
    vence.setDate(vence.getDate() + programa.expiresInDays);

    await this.tenantPrisma.db.cashbackEntry.create({
      data: {
        customerId: pedido.customerId,
        orderId,
        type: CashbackEntryType.EARN,
        amountCents: valor,
        description: `${programa.cashbackBps / 100}% de volta`,
        expiresAt: vence,
      } as any,
    });

    await this.tenantPrisma.db.order.update({
      where: { id: orderId },
      data: { cashbackEarnedCents: valor },
    });

    const saldo = await this.recalcularSaldo(pedido.customerId);
    this.logger.log(`Cashback de ${valor} centavos creditado (saldo agora: ${saldo}).`);

    return { creditado: valor, saldo };
  }

  /**
   * Vence o cashback que passou da validade.
   * Roda todo dia pela fila.
   */
  async expirarVencidos() {
    // Operação de sistema: varre TODOS os tenants.
    const vencidos = await this.prisma.cashbackEntry.findMany({
      where: {
        type: CashbackEntryType.EARN,
        expiresAt: { lt: new Date() },
        expiredAt: null,
      },
      select: { id: true, tenantId: true, customerId: true, amountCents: true },
      take: 1000,
    });

    if (vencidos.length === 0) return { expirados: 0 };

    let total = 0;

    for (const entrada of vencidos) {
      // Só vence o que ainda não foi gasto: se o cliente já usou tudo, não
      // faz sentido tirar de novo.
      const saldo = await this.prisma.tenantCustomer.findUnique({
        where: { id: entrada.customerId },
        select: { cashbackBalanceCents: true },
      });

      const aRetirar = Math.min(entrada.amountCents, saldo?.cashbackBalanceCents ?? 0);

      if (aRetirar > 0) {
        await this.prisma.cashbackEntry.create({
          data: {
            tenantId: entrada.tenantId,
            customerId: entrada.customerId,
            type: CashbackEntryType.EXPIRE,
            amountCents: -aRetirar,
            description: 'Cashback vencido',
          },
        });
        total += aRetirar;
      }

      await this.prisma.cashbackEntry.update({
        where: { id: entrada.id },
        data: { expiredAt: new Date() },
      });

      await this.context.runAsTenant(entrada.tenantId, () =>
        this.recalcularSaldo(entrada.customerId),
      );
    }

    this.logger.log(`Vencimento de cashback: ${total} centavos retirados.`);
    return { expirados: total, linhas: vencidos.length };
  }

  /** O extrato do cliente, para a ficha dele no CRM. */
  async extrato(customerId: string, limite = 50) {
    return this.tenantPrisma.db.cashbackEntry.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limite,
      include: { order: { select: { code: true } } },
    });
  }

  /** Ajuste manual (gerente dando um crédito de cortesia). */
  async ajustar(customerId: string, amountCents: number, motivo: string) {
    if (amountCents === 0) throw new BadRequestException('Informe um valor.');

    await this.tenantPrisma.db.cashbackEntry.create({
      data: {
        customerId,
        type: CashbackEntryType.ADJUST,
        amountCents,
        description: motivo || 'Ajuste manual',
      } as any,
    });

    return { saldo: await this.recalcularSaldo(customerId) };
  }
}
