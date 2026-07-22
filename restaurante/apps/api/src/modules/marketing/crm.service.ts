import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerSegment, Prisma } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { LoyaltyService } from './loyalty.service';

/**
 * Segmentos de clientes — a base do marketing.
 *
 * Traduz "clientes inativos" em uma condição de busca no banco.
 */
export function filtroDoSegmento(
  segmento: CustomerSegment,
  diasInativo = 30,
  agora = new Date(),
): Prisma.TenantCustomerWhereInput {
  const limite = new Date(agora);
  limite.setDate(limite.getDate() - diasInativo);

  switch (segmento) {
    case CustomerSegment.FIRST_ORDER:
      // ainda não pediu
      return { ordersCount: 0 };

    case CustomerSegment.NEW:
      // pediu uma vez só
      return { ordersCount: 1 };

    case CustomerSegment.RECURRING:
      // já é de casa
      return { ordersCount: { gte: 3 } };

    case CustomerSegment.INACTIVE:
      // já pediu, mas sumiu
      return { ordersCount: { gt: 0 }, lastOrderAt: { lt: limite } };

    case CustomerSegment.ALL:
    default:
      return {};
  }
}

export const NOME_DO_SEGMENTO: Record<CustomerSegment, string> = {
  ALL: 'Todos os clientes',
  FIRST_ORDER: 'Ainda não pediram',
  NEW: 'Novos (1 pedido)',
  RECURRING: 'Recorrentes (3+ pedidos)',
  INACTIVE: 'Inativos',
};

@Injectable()
export class CrmService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly loyalty: LoyaltyService,
  ) {}

  /** Lista de clientes, com filtro por marca, segmento e busca por nome/telefone. */
  async listar(filtro: {
    brandId?: string;
    segmento?: CustomerSegment;
    diasInativo?: number;
    busca?: string;
    limite?: number;
  }) {
    const where: Prisma.TenantCustomerWhereInput = {
      ...(filtro.brandId ? { brandId: filtro.brandId } : {}),
      ...filtroDoSegmento(filtro.segmento ?? CustomerSegment.ALL, filtro.diasInativo ?? 30),
    };

    if (filtro.busca?.trim()) {
      const busca = filtro.busca.trim();
      where.OR = [
        { name: { contains: busca, mode: 'insensitive' } },
        { phone: { contains: busca.replace(/\D/g, '') } },
      ];
    }

    const clientes = await this.tenantPrisma.db.tenantCustomer.findMany({
      where,
      orderBy: { lastOrderAt: { sort: 'desc', nulls: 'last' } },
      take: Math.min(filtro.limite ?? 100, 500),
      include: { brand: { select: { id: true, name: true, primaryColor: true } } },
    });

    return clientes.map((c) => ({
      id: c.id,
      nome: c.name,
      telefone: c.phone,
      marca: c.brand,
      pedidos: c.ordersCount,
      totalGastoCents: c.totalSpentCents,
      ticketMedioCents: c.ordersCount > 0 ? Math.round(c.totalSpentCents / c.ordersCount) : 0,
      cashbackCents: c.cashbackBalanceCents,
      ultimoPedido: c.lastOrderAt,
      diasSemPedir: c.lastOrderAt
        ? Math.floor((Date.now() - c.lastOrderAt.getTime()) / 86400000)
        : null,
      bairro: c.addressDistrict,
      optOut: c.optOut,
    }));
  }

  /** Quantos clientes em cada segmento — os números do topo da tela. */
  async contarSegmentos(brandId?: string, diasInativo = 30) {
    const base = brandId ? { brandId } : {};

    const segmentos = Object.values(CustomerSegment);
    const contagens = await Promise.all(
      segmentos.map(async (s) => ({
        segmento: s,
        label: NOME_DO_SEGMENTO[s],
        total: await this.tenantPrisma.db.tenantCustomer.count({
          where: { ...base, ...filtroDoSegmento(s, diasInativo) },
        }),
      })),
    );

    return contagens;
  }

  /** A ficha completa de um cliente. */
  async ficha(customerId: string) {
    const c = await this.tenantPrisma.db.tenantCustomer.findUnique({
      where: { id: customerId },
      include: {
        brand: { select: { id: true, name: true, primaryColor: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            code: true,
            status: true,
            channel: true,
            totalCents: true,
            discountCents: true,
            cashbackRedeemedCents: true,
            cashbackEarnedCents: true,
            createdAt: true,
          },
        },
      },
    });

    if (!c) throw new NotFoundException('Cliente não encontrado.');

    const extrato = await this.loyalty.extrato(customerId, 30);
    const mensagens = await this.tenantPrisma.db.outboundMessage.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      id: c.id,
      nome: c.name,
      telefone: c.phone,
      marca: c.brand,
      pedidos: c.ordersCount,
      totalGastoCents: c.totalSpentCents,
      ticketMedioCents: c.ordersCount > 0 ? Math.round(c.totalSpentCents / c.ordersCount) : 0,
      cashbackCents: c.cashbackBalanceCents,
      primeiroPedido: c.firstOrderAt,
      ultimoPedido: c.lastOrderAt,
      optOut: c.optOut,
      endereco: {
        rua: c.addressStreet,
        numero: c.addressNumber,
        bairro: c.addressDistrict,
        cidade: c.addressCity,
        complemento: c.addressNote,
      },
      historico: c.orders,
      extratoCashback: extrato.map((e) => ({
        id: e.id,
        tipo: e.type,
        valorCents: e.amountCents,
        descricao: e.description,
        pedido: e.order?.code ?? null,
        venceEm: e.expiresAt,
        quando: e.createdAt,
      })),
      mensagens: mensagens.map((m) => ({
        id: m.id,
        tipo: m.kind,
        status: m.status,
        texto: m.body,
        quando: m.createdAt,
      })),
    };
  }

  /** O cliente pediu para não receber campanha. */
  async alternarOptOut(customerId: string, optOut: boolean) {
    return this.tenantPrisma.db.tenantCustomer.update({
      where: { id: customerId },
      data: { optOut },
      select: { id: true, name: true, optOut: true },
    });
  }
}
