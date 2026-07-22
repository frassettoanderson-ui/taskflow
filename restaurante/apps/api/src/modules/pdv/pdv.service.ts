import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SalesChannel,
} from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrderService } from '../order/order.service';
import { calcularSplit, lerRegras } from '../order/pricing';
import { inicioDoDia, fimDoDia } from '../../common/datas';
import { VendaPdvDto } from './dto/venda-pdv.dto';

/**
 * PDV — o caixa do balcão.
 *
 * A diferença para tudo o que já existe é o TEMPO do dinheiro:
 *   - delivery: o cliente paga ANTES, e o banco avisa depois (webhook);
 *   - mesa: o cliente come primeiro e paga no fim (comanda);
 *   - balcão: pede e paga AGORA, na frente do caixa.
 *
 * Por isso a venda do PDV nasce já paga e já na cozinha, num passo só. Não há
 * "aguardando pagamento" no balcão — se o cliente desistir, ninguém cobra.
 */
@Injectable()
export class PdvService {
  private readonly logger = new Logger(PdvService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly orders: OrderService,
  ) {}

  /**
   * O que o caixa vê ao abrir a tela: as marcas que têm cardápio de balcão.
   *
   * Marca sem cardápio de balcão simplesmente não aparece — evita o caixa
   * escolher uma marca e cair numa tela vazia sem entender por quê.
   */
  async marcas() {
    const menus = await this.tenantPrisma.db.menu.findMany({
      where: { channel: SalesChannel.COUNTER, active: true },
      select: {
        brand: { select: { id: true, name: true, slug: true, primaryColor: true, paused: true } },
      },
    });

    return menus
      .map((m) => m.brand)
      .filter((b) => !b.paused)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * O cardápio de balcão de uma marca, já no formato que a tela de venda usa.
   *
   * Diferente do cardápio do cliente, aqui os itens pausados NÃO aparecem: o
   * caixa não deve nem conseguir clicar no que acabou.
   */
  async cardapio(brandId: string) {
    const menu = await this.tenantPrisma.db.menu.findFirst({
      where: { brandId, channel: SalesChannel.COUNTER, active: true },
      include: {
        categories: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              where: { active: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                modifierGroups: {
                  orderBy: { sortOrder: 'asc' },
                  include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
                },
              },
            },
          },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException(
        'Esta marca ainda não tem cardápio de balcão. Crie um em Cadastro → Cardápio → + Balcão.',
      );
    }

    return {
      menuId: menu.id,
      categories: menu.categories.map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          priceCents: i.priceCents,
          imageUrl: i.imageUrl,
          disponivel: true,
          modifierGroups: i.modifierGroups.map((g) => ({
            id: g.id,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            modifiers: g.modifiers.map((m) => ({
              id: m.id,
              name: m.name,
              priceDeltaCents: m.priceDeltaCents,
            })),
          })),
        })),
      })),
    };
  }

  /**
   * Fecha a venda: cria o pedido, marca como pago e manda para a cozinha.
   *
   * Tudo numa chamada só, de propósito — no balcão o caixa não pode depender de
   * dois cliques que podem falhar no meio e deixar uma venda paga sem pedido.
   */
  async fechar(dto: VendaPdvDto, operadorId: string) {
    const brand = await this.tenantPrisma.db.brand.findUnique({
      where: { id: dto.brandId },
      select: { id: true, tenantId: true, name: true, paused: true, pausedReason: true },
    });
    if (!brand) throw new NotFoundException('Marca não encontrada.');
    if (brand.paused) {
      throw new BadRequestException(`A marca está pausada: ${brand.pausedReason ?? 'sem motivo'}.`);
    }

    // Confere itens e recalcula os preços lendo do BANCO — o caixa manda os ids,
    // nunca os valores. É a mesma trava do delivery e da mesa.
    const { linhas, subtotalCents } = await this.orders.montarLinhas(
      brand.id,
      SalesChannel.COUNTER,
      dto.items,
    );

    // No balcão não há frete nem cupom: o total é o subtotal.
    const totalCents = subtotalCents;

    // Dinheiro: confere se deu para pagar e calcula o troco.
    let changeCents = 0;
    if (dto.paymentMethod === PaymentMethod.CASH) {
      const recebido = dto.receivedCents ?? 0;
      if (recebido > 0) {
        if (recebido < totalCents) {
          throw new BadRequestException('O valor recebido é menor que o total da venda.');
        }
        changeCents = recebido - totalCents;
      }
    }

    // Cliente identificado é opcional. Só criamos ficha no CRM se o caixa
    // digitou o telefone — sem isso não há como reconhecer a pessoa depois.
    let customerId: string | null = null;
    if (dto.customerPhone?.trim()) {
      const cliente = await this.orders.acharOuCriarCliente(brand.id, {
        customerName: dto.customerName?.trim() || 'Balcão',
        customerPhone: dto.customerPhone.trim(),
      });
      customerId = cliente.id;
    }

    const unitId = await this.orders.unidadeDaMarca(brand.id);
    const code = await this.orders.gerarCodigoUnico();

    const pedido = await this.tenantPrisma.db.order.create({
      data: {
        tenantId: brand.tenantId,
        brandId: brand.id,
        channel: SalesChannel.COUNTER,
        source: OrderSource.DIRECT, // balcão é canal próprio: sem comissão
        unitId,
        customerId,
        code,
        // Já pago e já na cozinha — é o ponto todo do balcão.
        status: OrderStatus.RECEIVED,
        customerName: dto.customerName?.trim() || 'Balcão',
        customerPhone: dto.customerPhone?.trim() || '-',
        notes: dto.notes,
        waiterId: operadorId, // quem passou a venda, para o fechamento de caixa
        subtotalCents,
        deliveryFeeCents: 0,
        discountCents: 0,
        totalCents,
        items: {
          create: linhas.map((l) => ({
            tenantId: brand.tenantId,
            itemId: l.itemId,
            nameSnapshot: l.nameSnapshot,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            totalCents: l.totalCents,
            notes: l.notes,
            stationId: l.stationId,
            stationNameSnapshot: l.stationNameSnapshot,
            modifiers: {
              create: l.modifiers.map((m) => ({
                tenantId: brand.tenantId,
                modifierId: m.modifierId,
                nameSnapshot: m.nameSnapshot,
                priceDeltaCents: m.priceDeltaCents,
              })),
            },
          })),
        },
      },
      include: { items: { include: { modifiers: true } } },
    });

    // O pagamento é registrado como JÁ PAGO: o dinheiro está na gaveta ou a
    // maquininha aprovou ali na hora. Não há gateway envolvido — e é por isso
    // que o provider se chama "pdv", não "fake-pix": não estamos fingindo nada,
    // o dinheiro entrou de verdade, só não passou pelo nosso sistema.
    await this.tenantPrisma.db.payment.create({
      data: {
        tenantId: brand.tenantId,
        orderId: pedido.id,
        provider: 'pdv',
        externalId: `pdv_${pedido.id}`,
        method: dto.paymentMethod,
        status: PaymentStatus.PAID,
        amountCents: totalCents,
        paidAt: new Date(),
      },
    });

    // A divisão do dinheiro fica gravada igual à do delivery, para o financeiro
    // enxergar a venda do balcão do mesmo jeito. Aqui a taxa de pagamento é a
    // única fatia: não há frete nem comissão de portal.
    try {
      const regras = lerRegras();
      const split = calcularSplit({
        source: OrderSource.DIRECT,
        method: dto.paymentMethod,
        subtotalCents,
        deliveryFeeCents: 0,
        regras,
        restauranteExternalId: `restaurant:${brand.id}`,
        plataformaExternalId: 'platform',
      });

      await this.tenantPrisma.db.orderSplit.create({
        data: {
          tenantId: brand.tenantId,
          orderId: pedido.id,
          totalCents: split.totalCents,
          restaurantCents: split.detalhe.restauranteCents,
          platformCents: split.detalhe.plataformaCents,
          courierCents: 0,
          portalCommissionCents: 0,
          paymentFeeCents: split.detalhe.taxaPagamentoCents,
          deliveryPlatformFeeCents: 0,
          restaurantRecipientId: `restaurant:${brand.id}`,
          platformRecipientId: 'platform',
          provider: 'pdv',
        } as any,
      });
    } catch (e) {
      // Split é contabilidade: se falhar, a venda continua feita. O cliente já
      // pagou e a comida já está sendo produzida — travar aqui seria pior.
      this.logger.error(`Falhei ao gravar o split da venda ${pedido.code}: ${e}`);
    }

    await this.orders.registrarEvento(
      brand.tenantId,
      brand.id,
      pedido.id,
      pedido.code,
      'order.created',
      { totalCents, itens: linhas.length, canal: SalesChannel.COUNTER, origem: 'pdv' },
    );
    await this.orders.registrarEvento(
      brand.tenantId,
      brand.id,
      pedido.id,
      pedido.code,
      'order.paid',
      { totalCents, forma: dto.paymentMethod, provider: 'pdv' },
    );

    return {
      pedido: this.orders.formatarPedido(pedido),
      changeCents,
      paymentMethod: dto.paymentMethod,
    };
  }

  /**
   * Fechamento de caixa: o que passou no balcão hoje.
   *
   * Separado por forma de pagamento porque é assim que se confere a gaveta —
   * o dinheiro tem que bater com a linha "Dinheiro", não com o total.
   */
  async resumoDoDia(brandId?: string) {
    // Sem argumento, os ajudantes usam HOJE no fuso local — que é o que o caixa
    // entende por "hoje". Passar new Date('...') aqui daria o dia errado à noite.
    const pedidos = await this.tenantPrisma.db.order.findMany({
      where: {
        channel: SalesChannel.COUNTER,
        status: { not: OrderStatus.CANCELED },
        createdAt: { gte: inicioDoDia(), lte: fimDoDia() },
        ...(brandId ? { brandId } : {}),
      },
      include: {
        payment: { select: { method: true, status: true } },
        brand: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const porForma: Record<string, { quantidade: number; totalCents: number }> = {
      CASH: { quantidade: 0, totalCents: 0 },
      CARD: { quantidade: 0, totalCents: 0 },
      PIX: { quantidade: 0, totalCents: 0 },
    };

    for (const p of pedidos) {
      const forma = p.payment?.method ?? 'CASH';
      porForma[forma].quantidade += 1;
      porForma[forma].totalCents += p.totalCents;
    }

    return {
      quantidade: pedidos.length,
      totalCents: pedidos.reduce((s, p) => s + p.totalCents, 0),
      porForma,
      ultimas: pedidos.slice(0, 20).map((p) => ({
        id: p.id,
        code: p.code,
        marca: p.brand.name,
        cliente: p.customerName,
        totalCents: p.totalCents,
        forma: p.payment?.method ?? null,
        status: p.status,
        criadoEm: p.createdAt,
      })),
    };
  }
}
