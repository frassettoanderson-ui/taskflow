import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StockMovementType, SupplyUnit } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';

/** Como cada medida aparece na tela. */
export const NOME_DA_MEDIDA: Record<SupplyUnit, string> = {
  KG: 'kg',
  G: 'g',
  L: 'L',
  ML: 'ml',
  UN: 'un',
};

/**
 * O custo de UMA linha da ficha técnica.
 *
 * A perda entra na conta porque o restaurante paga por ela igual: se 20% da
 * cebola vai fora na hora de descascar, para colocar 100g no prato é preciso
 * comprar 125g.
 */
export function custoDaLinha(
  quantidade: number,
  perdaPercent: number,
  custoPorUnidadeCents: number,
): number {
  const fator = 1 + (perdaPercent || 0) / 100;
  return Math.round(quantidade * fator * custoPorUnidadeCents);
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // =========================================================================
  //  INSUMOS
  // =========================================================================

  async listarInsumos() {
    const insumos = await this.tenantPrisma.db.supply.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { recipeItems: true } } },
    });

    return insumos.map((s) => ({
      id: s.id,
      nome: s.name,
      medida: s.measure,
      medidaLabel: NOME_DA_MEDIDA[s.measure],
      custoPorUnidadeCents: s.costPerUnitCents,
      estoque: s.stockQty,
      estoqueMinimo: s.minStockQty,
      /** o alerta que o dono quer ver */
      abaixoDoMinimo: s.minStockQty > 0 && s.stockQty <= s.minStockQty,
      usadoEmPratos: s._count.recipeItems,
      ativo: s.active,
    }));
  }

  criarInsumo(dados: {
    name: string;
    measure: SupplyUnit;
    costPerUnitCents: number;
    stockQty?: number;
    minStockQty?: number;
    unitId?: string;
  }) {
    return this.tenantPrisma.db.supply.create({ data: dados as any });
  }

  atualizarInsumo(id: string, dados: Partial<{ name: string; costPerUnitCents: number; minStockQty: number; active: boolean }>) {
    return this.tenantPrisma.db.supply.update({ where: { id }, data: dados });
  }

  /**
   * Entrada, perda ou acerto de inventário.
   * Todo movimento fica registrado — o estoque é sempre explicável.
   */
  async movimentar(dados: {
    supplyId: string;
    type: StockMovementType;
    quantity: number;
    unitCostCents?: number;
    note?: string;
  }) {
    const insumo = await this.tenantPrisma.db.supply.findUnique({ where: { id: dados.supplyId } });
    if (!insumo) throw new NotFoundException('Insumo não encontrado.');

    // Entrada e devolução somam; saída e perda subtraem. O ajuste define o valor.
    let delta = dados.quantity;
    if (dados.type === StockMovementType.OUT || dados.type === StockMovementType.LOSS) {
      delta = -Math.abs(dados.quantity);
    } else if (dados.type === StockMovementType.ADJUST) {
      delta = dados.quantity - insumo.stockQty; // o valor informado vira o novo saldo
    } else {
      delta = Math.abs(dados.quantity);
    }

    await this.tenantPrisma.db.stockMovement.create({
      data: {
        supplyId: dados.supplyId,
        type: dados.type,
        quantity: delta,
        unitCostCents: dados.unitCostCents ?? insumo.costPerUnitCents,
        note: dados.note,
      } as any,
    });

    // Compra atualiza o custo de referência do insumo.
    const novoCusto =
      dados.type === StockMovementType.IN && dados.unitCostCents
        ? dados.unitCostCents
        : insumo.costPerUnitCents;

    return this.tenantPrisma.db.supply.update({
      where: { id: dados.supplyId },
      data: {
        stockQty: Math.round((insumo.stockQty + delta) * 1000) / 1000,
        costPerUnitCents: novoCusto,
      },
    });
  }

  /** O extrato de um insumo. */
  extrato(supplyId: string, limite = 50) {
    return this.tenantPrisma.db.stockMovement.findMany({
      where: { supplyId },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
  }

  // =========================================================================
  //  FICHA TÉCNICA E CMV
  // =========================================================================

  /**
   * A ficha técnica de um prato, com o CMV e a margem.
   *
   * CMV = Custo da Mercadoria Vendida: quanto custa produzir aquele prato.
   * Margem = preço de venda − CMV. É o dinheiro que sobra antes das despesas.
   */
  async fichaTecnica(itemId: string) {
    const item = await this.tenantPrisma.db.item.findUnique({
      where: { id: itemId },
      include: {
        recipe: { include: { supply: true }, orderBy: { createdAt: 'asc' } },
        category: { include: { menu: { include: { brand: { select: { name: true } } } } } },
      },
    });
    if (!item) throw new NotFoundException('Item não encontrado.');

    const linhas = item.recipe.map((r) => {
      const custo = custoDaLinha(r.quantity, r.wastePercent, r.supply.costPerUnitCents);
      return {
        id: r.id,
        supplyId: r.supplyId,
        insumo: r.supply.name,
        medida: NOME_DA_MEDIDA[r.supply.measure],
        quantidade: r.quantity,
        perdaPercent: r.wastePercent,
        /// quanto sai do estoque de verdade (já com a perda)
        quantidadeBruta: Math.round(r.quantity * (1 + r.wastePercent / 100) * 1000) / 1000,
        custoPorUnidadeCents: r.supply.costPerUnitCents,
        custoCents: custo,
      };
    });

    const cmvCents = linhas.reduce((s, l) => s + l.custoCents, 0);
    const precoCents = item.priceCents;
    const margemCents = precoCents - cmvCents;

    return {
      item: {
        id: item.id,
        nome: item.name,
        precoCents,
        marca: item.category.menu.brand.name,
        canal: item.category.menu.channel,
      },
      linhas,
      cmvCents,
      margemCents,
      /** quanto do preço é custo (quanto menor, melhor) */
      cmvPercent: precoCents > 0 ? Math.round((cmvCents / precoCents) * 1000) / 10 : 0,
      margemPercent: precoCents > 0 ? Math.round((margemCents / precoCents) * 1000) / 10 : 0,
      completa: linhas.length > 0,
    };
  }

  async definirLinhaDaFicha(dados: {
    itemId: string;
    supplyId: string;
    quantity: number;
    wastePercent?: number;
  }) {
    if (dados.quantity <= 0) throw new BadRequestException('A quantidade precisa ser maior que zero.');

    return this.tenantPrisma.db.recipeItem.upsert({
      where: { itemId_supplyId: { itemId: dados.itemId, supplyId: dados.supplyId } },
      update: { quantity: dados.quantity, wastePercent: dados.wastePercent ?? 0 },
      create: {
        itemId: dados.itemId,
        supplyId: dados.supplyId,
        quantity: dados.quantity,
        wastePercent: dados.wastePercent ?? 0,
      } as any,
    });
  }

  removerLinhaDaFicha(id: string) {
    return this.tenantPrisma.db.recipeItem.delete({ where: { id } });
  }

  /** CMV e margem de TODOS os pratos — a tela de rentabilidade. */
  async rentabilidade(brandId?: string) {
    const itens = await this.tenantPrisma.db.item.findMany({
      where: {
        active: true,
        ...(brandId ? { category: { menu: { brandId } } } : {}),
      },
      include: {
        recipe: { include: { supply: true } },
        category: { include: { menu: { include: { brand: { select: { name: true } } } } } },
      },
      orderBy: { name: 'asc' },
    });

    return itens
      .map((item) => {
        const cmv = item.recipe.reduce(
          (s, r) => s + custoDaLinha(r.quantity, r.wastePercent, r.supply.costPerUnitCents),
          0,
        );
        const margem = item.priceCents - cmv;

        return {
          itemId: item.id,
          nome: item.name,
          marca: item.category.menu.brand.name,
          canal: item.category.menu.channel,
          precoCents: item.priceCents,
          cmvCents: cmv,
          margemCents: margem,
          cmvPercent: item.priceCents > 0 ? Math.round((cmv / item.priceCents) * 1000) / 10 : 0,
          margemPercent: item.priceCents > 0 ? Math.round((margem / item.priceCents) * 1000) / 10 : 0,
          temFicha: item.recipe.length > 0,
        };
      })
      .sort((a, b) => a.margemPercent - b.margemPercent); // pior margem primeiro
  }

  // =========================================================================
  //  BAIXA AUTOMÁTICA NA VENDA
  // =========================================================================

  /**
   * Dá baixa no estoque dos insumos de um pedido.
   *
   * Roda quando a COZINHA ACEITA o pedido — é o momento em que o insumo sai da
   * prateleira de verdade. É idempotente: se rodar duas vezes, a segunda não
   * baixa de novo.
   */
  async baixarPorPedido(orderId: string) {
    const pedido = await this.tenantPrisma.db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!pedido) return { baixado: 0, motivo: 'pedido não encontrado' };
    if (pedido.stockConsumedAt) return { baixado: 0, motivo: 'estoque já baixado' };

    const consumo = await this.calcularConsumo(pedido.items);

    for (const c of consumo) {
      await this.tenantPrisma.db.stockMovement.create({
        data: {
          supplyId: c.supplyId,
          type: StockMovementType.OUT,
          quantity: -c.quantidade,
          unitCostCents: c.custoUnitarioCents,
          orderId,
          note: `Venda do pedido ${pedido.code}`,
        } as any,
      });

      await this.tenantPrisma.db.supply.update({
        where: { id: c.supplyId },
        data: { stockQty: { decrement: c.quantidade } },
      });
    }

    await this.tenantPrisma.db.order.update({
      where: { id: orderId },
      data: { stockConsumedAt: new Date() },
    });

    this.logger.log(`Estoque baixado no pedido ${pedido.code}: ${consumo.length} insumo(s).`);
    return { baixado: consumo.length, insumos: consumo };
  }

  /**
   * Devolve ao estoque o que já tinha sido baixado.
   * Roda quando um pedido é cancelado depois de aceito.
   */
  async devolverPorPedido(orderId: string) {
    const pedido = await this.tenantPrisma.db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!pedido || !pedido.stockConsumedAt) {
      return { devolvido: 0, motivo: 'este pedido não tinha baixado estoque' };
    }

    const consumo = await this.calcularConsumo(pedido.items);

    for (const c of consumo) {
      await this.tenantPrisma.db.stockMovement.create({
        data: {
          supplyId: c.supplyId,
          type: StockMovementType.RETURN,
          quantity: c.quantidade,
          unitCostCents: c.custoUnitarioCents,
          orderId,
          note: `Cancelamento do pedido ${pedido.code}`,
        } as any,
      });

      await this.tenantPrisma.db.supply.update({
        where: { id: c.supplyId },
        data: { stockQty: { increment: c.quantidade } },
      });
    }

    await this.tenantPrisma.db.order.update({
      where: { id: orderId },
      data: { stockConsumedAt: null },
    });

    return { devolvido: consumo.length };
  }

  /** Soma o que as fichas técnicas dos itens do pedido consomem. */
  private async calcularConsumo(itens: Array<{ itemId: string | null; quantity: number }>) {
    const ids = itens.map((i) => i.itemId).filter((i): i is string => !!i);
    if (ids.length === 0) return [];

    const fichas = await this.tenantPrisma.db.recipeItem.findMany({
      where: { itemId: { in: ids } },
      include: { supply: true },
    });

    const porInsumo = new Map<
      string,
      { supplyId: string; nome: string; quantidade: number; custoUnitarioCents: number }
    >();

    for (const linha of itens) {
      if (!linha.itemId) continue;
      const daFicha = fichas.filter((f) => f.itemId === linha.itemId);

      for (const f of daFicha) {
        // quantidade bruta (com perda) × quantas unidades do prato foram pedidas
        const bruta = f.quantity * (1 + f.wastePercent / 100) * linha.quantity;
        const atual = porInsumo.get(f.supplyId);

        if (atual) {
          atual.quantidade += bruta;
        } else {
          porInsumo.set(f.supplyId, {
            supplyId: f.supplyId,
            nome: f.supply.name,
            quantidade: bruta,
            custoUnitarioCents: f.supply.costPerUnitCents,
          });
        }
      }
    }

    return [...porInsumo.values()].map((c) => ({
      ...c,
      quantidade: Math.round(c.quantidade * 1000) / 1000,
    }));
  }

  /** Insumos abaixo do mínimo — o alerta do painel. */
  async alertas() {
    const insumos = await this.tenantPrisma.db.supply.findMany({
      where: { active: true, minStockQty: { gt: 0 } },
      orderBy: { name: 'asc' },
    });

    return insumos
      .filter((s) => s.stockQty <= s.minStockQty)
      .map((s) => ({
        id: s.id,
        nome: s.name,
        estoque: s.stockQty,
        minimo: s.minStockQty,
        medida: NOME_DA_MEDIDA[s.measure],
        acabou: s.stockQty <= 0,
      }));
  }
}
