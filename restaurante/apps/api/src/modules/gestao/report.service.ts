import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma, SalesChannel } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { NOME_DO_CANAL } from '../operation/channel';
import { fimDoDia, inicioDoDia, inicioDoMes, paraTextoLocal } from '../../common/datas';

export interface FiltroDeRelatorio {
  de?: string;
  ate?: string;
  brandId?: string;
  unitId?: string;
  channel?: SalesChannel;
}

/** Pedidos que contam como venda: não conta cancelado nem o que não foi pago. */
const VENDIDOS: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.ACCEPTED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

@Injectable()
export class ReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * Traduz o filtro da tela numa condição de busca.
   * As datas são montadas no fuso LOCAL — ver o comentário em common/datas.ts.
   */
  private where(f: FiltroDeRelatorio): Prisma.OrderWhereInput {
    const de = inicioDoDia(f.de, inicioDoMes());
    const ate = fimDoDia(f.ate);

    return {
      status: { in: VENDIDOS },
      createdAt: { gte: de, lte: ate },
      ...(f.brandId ? { brandId: f.brandId } : {}),
      ...(f.unitId ? { unitId: f.unitId } : {}),
      ...(f.channel ? { channel: f.channel } : {}),
    };
  }


  /**
   * O painel de vendas: faturamento, ticket médio e quantidade.
   * Consolidado e quebrado por marca, por canal e por dia.
   */
  async vendas(f: FiltroDeRelatorio) {
    const where = this.where(f);

    const pedidos = await this.tenantPrisma.db.order.findMany({
      where,
      select: {
        id: true,
        brandId: true,
        channel: true,
        createdAt: true,
        subtotalCents: true,
        discountCents: true,
        cashbackRedeemedCents: true,
        deliveryFeeCents: true,
        totalCents: true,
        brand: { select: { name: true, primaryColor: true } },
      },
    });

    const total = pedidos.reduce((s, p) => s + p.totalCents, 0);
    const itensCents = pedidos.reduce((s, p) => s + p.subtotalCents, 0);
    const descontos = pedidos.reduce((s, p) => s + p.discountCents + p.cashbackRedeemedCents, 0);
    const fretes = pedidos.reduce((s, p) => s + p.deliveryFeeCents, 0);

    // ---- por marca ----
    const porMarca = new Map<string, { nome: string; cor: string; pedidos: number; totalCents: number }>();
    for (const p of pedidos) {
      const atual = porMarca.get(p.brandId) ?? {
        nome: p.brand.name,
        cor: p.brand.primaryColor,
        pedidos: 0,
        totalCents: 0,
      };
      atual.pedidos += 1;
      atual.totalCents += p.totalCents;
      porMarca.set(p.brandId, atual);
    }

    // ---- por canal ----
    const porCanal = new Map<string, { pedidos: number; totalCents: number }>();
    for (const p of pedidos) {
      const atual = porCanal.get(p.channel) ?? { pedidos: 0, totalCents: 0 };
      atual.pedidos += 1;
      atual.totalCents += p.totalCents;
      porCanal.set(p.channel, atual);
    }

    // ---- por dia ----
    const porDia = new Map<string, { pedidos: number; totalCents: number }>();
    for (const p of pedidos) {
      // Dia no fuso local: com toISOString, um pedido das 22h cairia no dia seguinte.
      const dia = paraTextoLocal(p.createdAt);
      const atual = porDia.get(dia) ?? { pedidos: 0, totalCents: 0 };
      atual.pedidos += 1;
      atual.totalCents += p.totalCents;
      porDia.set(dia, atual);
    }

    return {
      periodo: {
        de: paraTextoLocal(inicioDoDia(f.de, inicioDoMes())),
        ate: paraTextoLocal(fimDoDia(f.ate)),
      },
      resumo: {
        pedidos: pedidos.length,
        faturamentoCents: total,
        ticketMedioCents: pedidos.length > 0 ? Math.round(total / pedidos.length) : 0,
        itensCents,
        descontosCents: descontos,
        fretesCents: fretes,
      },
      porMarca: [...porMarca.entries()]
        .map(([id, v]) => ({
          brandId: id,
          ...v,
          ticketMedioCents: v.pedidos > 0 ? Math.round(v.totalCents / v.pedidos) : 0,
        }))
        .sort((a, b) => b.totalCents - a.totalCents),
      porCanal: [...porCanal.entries()]
        .map(([canal, v]) => ({
          canal,
          label: NOME_DO_CANAL[canal as SalesChannel] ?? canal,
          ...v,
        }))
        .sort((a, b) => b.totalCents - a.totalCents),
      porDia: [...porDia.entries()].map(([dia, v]) => ({ dia, ...v })).sort((a, b) => a.dia.localeCompare(b.dia)),
    };
  }

  /** Os itens mais vendidos, com quanto cada um faturou. */
  async itensMaisVendidos(f: FiltroDeRelatorio, limite = 20) {
    const linhas = await this.tenantPrisma.db.orderItem.findMany({
      where: { order: this.where(f) },
      select: {
        itemId: true,
        nameSnapshot: true,
        quantity: true,
        totalCents: true,
      },
    });

    const mapa = new Map<string, { nome: string; quantidade: number; totalCents: number }>();
    for (const l of linhas) {
      const chave = l.itemId ?? l.nameSnapshot;
      const atual = mapa.get(chave) ?? { nome: l.nameSnapshot, quantidade: 0, totalCents: 0 };
      atual.quantidade += l.quantity;
      atual.totalCents += l.totalCents;
      mapa.set(chave, atual);
    }

    return [...mapa.entries()]
      .map(([itemId, v]) => ({ itemId, ...v }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, limite);
  }

  /**
   * Horários de pico: quantos pedidos entram em cada hora do dia,
   * e como se distribuem pelos dias da semana.
   */
  async horariosDePico(f: FiltroDeRelatorio) {
    const pedidos = await this.tenantPrisma.db.order.findMany({
      where: this.where(f),
      select: { createdAt: true, totalCents: true },
    });

    const porHora = Array.from({ length: 24 }, (_, h) => ({
      hora: h,
      label: `${String(h).padStart(2, '0')}h`,
      pedidos: 0,
      totalCents: 0,
    }));

    const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const porDiaSemana = DIAS.map((nome, i) => ({ dia: i, label: nome, pedidos: 0, totalCents: 0 }));

    for (const p of pedidos) {
      // O container roda no fuso de São Paulo, então a hora aqui é a hora local.
      const h = p.createdAt.getHours();
      porHora[h].pedidos += 1;
      porHora[h].totalCents += p.totalCents;

      const d = p.createdAt.getDay();
      porDiaSemana[d].pedidos += 1;
      porDiaSemana[d].totalCents += p.totalCents;
    }

    const pico = porHora.reduce((a, b) => (b.pedidos > a.pedidos ? b : a), porHora[0]);

    return {
      porHora,
      porDiaSemana,
      pico: pico.pedidos > 0 ? pico : null,
    };
  }

  /** Tudo junto, para a tela carregar de uma vez. */
  async painel(f: FiltroDeRelatorio) {
    const [vendas, itens, horarios] = await Promise.all([
      this.vendas(f),
      this.itensMaisVendidos(f, 10),
      this.horariosDePico(f),
    ]);

    return { ...vendas, itensMaisVendidos: itens, horarios };
  }
}
