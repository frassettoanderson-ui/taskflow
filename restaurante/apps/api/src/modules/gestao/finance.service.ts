import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntryStatus, EntryType, OrderStatus, Prisma } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { calcularSplit, lerRegras } from '../order/pricing';
import { custoDaLinha } from './stock.service';
import { fimDoDia, inicioDoDia, inicioDoMes, paraTextoLocal } from '../../common/datas';

export interface Periodo {
  de?: string;
  ate?: string;
  brandId?: string;
}

const VENDIDOS: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.ACCEPTED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** Usa sempre o fuso LOCAL — ver o comentário em common/datas.ts. */
  private intervalo(p: Periodo) {
    return {
      de: inicioDoDia(p.de, inicioDoMes()),
      ate: fimDoDia(p.ate),
    };
  }

  // =========================================================================
  //  LANÇAMENTOS (contas a pagar e a receber)
  // =========================================================================

  async listarLancamentos(filtro: {
    type?: EntryType;
    status?: EntryStatus;
    de?: string;
    ate?: string;
    limite?: number;
  }) {
    const where: Prisma.AccountEntryWhereInput = {
      ...(filtro.type ? { type: filtro.type } : {}),
      ...(filtro.status ? { status: filtro.status } : {}),
    };

    if (filtro.de || filtro.ate) {
      const { de, ate } = this.intervalo(filtro);
      where.dueDate = { gte: de, lte: ate };
    }

    const lancamentos = await this.tenantPrisma.db.accountEntry.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      take: Math.min(filtro.limite ?? 200, 500),
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return lancamentos.map((l) => ({
      id: l.id,
      tipo: l.type,
      status: l.status,
      categoria: l.category,
      descricao: l.description,
      valorCents: l.amountCents,
      vencimento: l.dueDate,
      pagoEm: l.paidAt,
      para: l.party,
      /** já passou do vencimento e não foi pago */
      atrasado: l.status === EntryStatus.OPEN && l.dueDate < hoje,
    }));
  }

  criarLancamento(dados: {
    type: EntryType;
    category: string;
    description: string;
    amountCents: number;
    dueDate: string;
    party?: string;
    brandId?: string;
    unitId?: string;
  }) {
    return this.tenantPrisma.db.accountEntry.create({
      data: { ...dados, dueDate: new Date(dados.dueDate) } as any,
    });
  }

  async quitar(id: string) {
    const l = await this.tenantPrisma.db.accountEntry.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Lançamento não encontrado.');

    return this.tenantPrisma.db.accountEntry.update({
      where: { id },
      data: { status: EntryStatus.PAID, paidAt: new Date() },
    });
  }

  /** Resumo do que vence: hoje, esta semana, atrasado. */
  async resumoDeContas() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimDoDia = new Date(hoje);
    fimDoDia.setHours(23, 59, 59, 999);
    const em7dias = new Date(hoje);
    em7dias.setDate(em7dias.getDate() + 7);

    const abertos = await this.tenantPrisma.db.accountEntry.findMany({
      where: { status: EntryStatus.OPEN },
      select: { type: true, amountCents: true, dueDate: true },
    });

    const somar = (f: (d: Date) => boolean, tipo: EntryType) =>
      abertos.filter((l) => l.type === tipo && f(l.dueDate)).reduce((s, l) => s + l.amountCents, 0);

    return {
      aPagar: {
        atrasadoCents: somar((d) => d < hoje, EntryType.PAYABLE),
        hojeCents: somar((d) => d >= hoje && d <= fimDoDia, EntryType.PAYABLE),
        proximos7Cents: somar((d) => d > fimDoDia && d <= em7dias, EntryType.PAYABLE),
        totalAbertoCents: abertos
          .filter((l) => l.type === EntryType.PAYABLE)
          .reduce((s, l) => s + l.amountCents, 0),
      },
      aReceber: {
        atrasadoCents: somar((d) => d < hoje, EntryType.RECEIVABLE),
        hojeCents: somar((d) => d >= hoje && d <= fimDoDia, EntryType.RECEIVABLE),
        proximos7Cents: somar((d) => d > fimDoDia && d <= em7dias, EntryType.RECEIVABLE),
        totalAbertoCents: abertos
          .filter((l) => l.type === EntryType.RECEIVABLE)
          .reduce((s, l) => s + l.amountCents, 0),
      },
    };
  }

  // =========================================================================
  //  DRE
  // =========================================================================

  /**
   * A DRE — Demonstração do Resultado do Exercício.
   *
   * Em português de dono de restaurante: quanto entrou, quanto disso foi
   * embora em taxa e comida, quanto sobrou de despesa, e o que ficou no bolso.
   *
   *   Receita bruta          (o que o cliente pagou)
   *   − Deduções             (comissões e taxas de pagamento)
   *   = Receita líquida
   *   − CMV                  (o custo da comida, pela ficha técnica)
   *   = Lucro bruto
   *   − Despesas             (aluguel, salários, o que você lançar)
   *   = Resultado
   */
  async dre(p: Periodo) {
    const { de, ate } = this.intervalo(p);

    const pedidos = await this.tenantPrisma.db.order.findMany({
      where: {
        status: { in: VENDIDOS },
        createdAt: { gte: de, lte: ate },
        ...(p.brandId ? { brandId: p.brandId } : {}),
      },
      select: {
        id: true,
        source: true,
        subtotalCents: true,
        discountCents: true,
        deliveryFeeCents: true,
        totalCents: true,
        items: { select: { itemId: true, quantity: true } },
      },
    });

    // ---- receita ----
    const receitaBruta = pedidos.reduce((s, o) => s + o.totalCents, 0);

    // ---- deduções: o que a plataforma retém (a mesma conta da Etapa 1) ----
    const regras = lerRegras();
    let deducoes = 0;
    for (const o of pedidos) {
      const split = calcularSplit({
        source: o.source,
        method: 'PIX',
        subtotalCents: o.subtotalCents - o.discountCents,
        deliveryFeeCents: o.deliveryFeeCents,
        regras,
        restauranteExternalId: 'r',
        plataformaExternalId: 'p',
      });
      deducoes += split.detalhe.plataformaCents + split.detalhe.motoboyCents;
    }

    // ---- CMV: quanto de comida saiu, pela ficha técnica ----
    const cmv = await this.calcularCmv(pedidos);

    // ---- despesas lançadas no período ----
    const despesas = await this.tenantPrisma.db.accountEntry.findMany({
      where: {
        type: EntryType.PAYABLE,
        status: { not: EntryStatus.CANCELED },
        dueDate: { gte: de, lte: ate },
        ...(p.brandId ? { brandId: p.brandId } : {}),
      },
      select: { category: true, amountCents: true },
    });

    const porCategoria = new Map<string, number>();
    for (const d of despesas) {
      porCategoria.set(d.category, (porCategoria.get(d.category) ?? 0) + d.amountCents);
    }
    const totalDespesas = despesas.reduce((s, d) => s + d.amountCents, 0);

    const receitaLiquida = receitaBruta - deducoes;
    const lucroBruto = receitaLiquida - cmv;
    const resultado = lucroBruto - totalDespesas;

    const pct = (v: number) => (receitaBruta > 0 ? Math.round((v / receitaBruta) * 1000) / 10 : 0);

    return {
      periodo: { de: paraTextoLocal(de), ate: paraTextoLocal(ate) },
      pedidos: pedidos.length,
      linhas: [
        { rotulo: 'Receita bruta', valorCents: receitaBruta, percent: 100, tipo: 'receita' },
        { rotulo: 'Deduções (comissões e frete)', valorCents: -deducoes, percent: -pct(deducoes), tipo: 'saida' },
        { rotulo: 'Receita líquida', valorCents: receitaLiquida, percent: pct(receitaLiquida), tipo: 'subtotal' },
        { rotulo: 'CMV (custo da comida)', valorCents: -cmv, percent: -pct(cmv), tipo: 'saida' },
        { rotulo: 'Lucro bruto', valorCents: lucroBruto, percent: pct(lucroBruto), tipo: 'subtotal' },
        { rotulo: 'Despesas', valorCents: -totalDespesas, percent: -pct(totalDespesas), tipo: 'saida' },
        { rotulo: 'Resultado', valorCents: resultado, percent: pct(resultado), tipo: 'resultado' },
      ],
      despesasPorCategoria: [...porCategoria.entries()]
        .map(([categoria, valorCents]) => ({ categoria, valorCents }))
        .sort((a, b) => b.valorCents - a.valorCents),
      /** margem final sobre a receita */
      margemPercent: pct(resultado),
    };
  }

  /** Soma o custo de ficha técnica de tudo que foi vendido no período. */
  private async calcularCmv(pedidos: Array<{ items: Array<{ itemId: string | null; quantity: number }> }>) {
    const vendidos = new Map<string, number>();
    for (const o of pedidos) {
      for (const i of o.items) {
        if (!i.itemId) continue;
        vendidos.set(i.itemId, (vendidos.get(i.itemId) ?? 0) + i.quantity);
      }
    }
    if (vendidos.size === 0) return 0;

    const fichas = await this.tenantPrisma.db.recipeItem.findMany({
      where: { itemId: { in: [...vendidos.keys()] } },
      include: { supply: { select: { costPerUnitCents: true } } },
    });

    let cmv = 0;
    for (const f of fichas) {
      const qtdVendida = vendidos.get(f.itemId) ?? 0;
      cmv += custoDaLinha(f.quantity, f.wastePercent, f.supply.costPerUnitCents) * qtdVendida;
    }
    return cmv;
  }

  /**
   * Registra a venda no financeiro quando o pedido é pago.
   * Idempotente: um pedido gera um lançamento só.
   */
  async registrarVenda(orderId: string) {
    const pedido = await this.tenantPrisma.db.order.findUnique({
      where: { id: orderId },
      select: { id: true, code: true, brandId: true, unitId: true, totalCents: true },
    });
    if (!pedido) return { criado: false };

    const jaExiste = await this.tenantPrisma.db.accountEntry.findFirst({
      where: { orderId, type: EntryType.RECEIVABLE },
    });
    if (jaExiste) return { criado: false, motivo: 'já lançado' };

    await this.tenantPrisma.db.accountEntry.create({
      data: {
        brandId: pedido.brandId,
        unitId: pedido.unitId,
        type: EntryType.RECEIVABLE,
        status: EntryStatus.PAID, // pagamento no ato
        category: 'Vendas',
        description: `Pedido ${pedido.code}`,
        amountCents: pedido.totalCents,
        dueDate: new Date(),
        paidAt: new Date(),
        orderId: pedido.id,
      } as any,
    });

    return { criado: true };
  }
}
