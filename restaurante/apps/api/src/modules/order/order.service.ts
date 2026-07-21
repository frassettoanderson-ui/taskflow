import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderSource, OrderStatus, Prisma, SalesChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { estaFinalizado, NOME_DO_STATUS, podeIr, proximoStatus } from './order.state-machine';
import { lerRegras } from './pricing';

/** Letras e números sem os que se confundem (0/O, 1/I). */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly realtime: RealtimeService,
  ) {}

  // =========================================================================
  //  CRIAR (vindo da página pública do cardápio)
  // =========================================================================

  /**
   * Cria o pedido a partir do carrinho do cliente.
   *
   * ⚠️ Regra de ouro: o navegador manda apenas O QUE o cliente escolheu
   * (ids e quantidades). QUANTO CUSTA é sempre recalculado aqui, lendo o preço
   * do banco. Assim ninguém consegue "editar o preço" pelo navegador.
   */
  async criarPedidoPublico(brandSlug: string, dto: CreateOrderDto) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: brandSlug },
      select: { id: true, tenantId: true, name: true },
    });
    if (!brand) throw new NotFoundException('Restaurante não encontrado.');

    return this.context.runAsTenant(brand.tenantId, async () => {
      // 1) Buscar no banco os itens que o cliente pediu (com seus complementos).
      const idsPedidos = [...new Set(dto.items.map((i) => i.itemId))];
      const itens = await this.tenantPrisma.db.item.findMany({
        where: { id: { in: idsPedidos }, active: true },
        include: { modifierGroups: { include: { modifiers: true } } },
      });

      const porId = new Map(itens.map((i) => [i.id, i]));

      // 2) Conferir cada linha e montar os valores.
      const linhas: Array<{
        itemId: string;
        nameSnapshot: string;
        unitPriceCents: number;
        quantity: number;
        totalCents: number;
        notes?: string;
        modifiers: Array<{ modifierId: string; nameSnapshot: string; priceDeltaCents: number }>;
      }> = [];

      let subtotalCents = 0;

      for (const linha of dto.items) {
        const item = porId.get(linha.itemId);
        if (!item) {
          throw new BadRequestException(
            'Um dos itens do carrinho não está mais disponível. Atualize o cardápio.',
          );
        }

        const escolhidos = new Set(linha.modifierIds ?? []);
        const complementos: Array<{
          modifierId: string;
          nameSnapshot: string;
          priceDeltaCents: number;
        }> = [];
        let extrasCents = 0;

        // Conferir as regras de cada grupo de complementos.
        for (const grupo of item.modifierGroups) {
          const doGrupo = grupo.modifiers.filter((m) => escolhidos.has(m.id) && m.active);

          if (doGrupo.length < grupo.minSelect) {
            throw new BadRequestException(
              `Em "${item.name}", escolha ${grupo.minSelect} opção em "${grupo.name}".`,
            );
          }
          if (doGrupo.length > grupo.maxSelect) {
            throw new BadRequestException(
              `Em "${item.name}", "${grupo.name}" aceita no máximo ${grupo.maxSelect}.`,
            );
          }

          for (const m of doGrupo) {
            complementos.push({
              modifierId: m.id,
              nameSnapshot: m.name,
              priceDeltaCents: m.priceDeltaCents,
            });
            extrasCents += m.priceDeltaCents;
            escolhidos.delete(m.id);
          }
        }

        // Sobrou algum complemento que não pertence a este item? Recusa.
        if (escolhidos.size > 0) {
          throw new BadRequestException(
            `Um complemento escolhido não pertence ao item "${item.name}".`,
          );
        }

        const totalLinha = (item.priceCents + extrasCents) * linha.quantity;
        subtotalCents += totalLinha;

        linhas.push({
          itemId: item.id,
          nameSnapshot: item.name,
          unitPriceCents: item.priceCents,
          quantity: linha.quantity,
          totalCents: totalLinha,
          notes: linha.notes,
          modifiers: complementos,
        });
      }

      // 3) Frete e total.
      const regras = lerRegras();
      const deliveryFeeCents = regras.taxaEntregaCents;
      const totalCents = subtotalCents + deliveryFeeCents;

      // 4) Agendamento: não aceitamos data no passado.
      let scheduledFor: Date | null = null;
      if (dto.scheduledFor) {
        const quando = new Date(dto.scheduledFor);
        if (quando.getTime() < Date.now() - 60_000) {
          throw new BadRequestException('O horário do agendamento já passou.');
        }
        scheduledFor = quando;
      }

      // 5) Gravar.
      const code = await this.gerarCodigoUnico();

      const pedido = await this.tenantPrisma.db.order.create({
        data: {
          // O tenantId aparece aqui só para o TypeScript ficar satisfeito:
          // quem manda de verdade é a camada de isolamento, que sobrescreve
          // este campo com o tenant do contexto. Valor errado aqui não passa.
          tenantId: brand.tenantId,
          brandId: brand.id,
          channel: SalesChannel.DELIVERY,
          source: OrderSource.DIRECT, // veio do canal próprio: SEM comissão
          code,
          status: OrderStatus.AWAITING_PAYMENT,
          customerName: dto.customerName.trim(),
          customerPhone: dto.customerPhone.trim(),
          addressStreet: dto.addressStreet,
          addressNumber: dto.addressNumber,
          addressDistrict: dto.addressDistrict,
          addressCity: dto.addressCity,
          addressNote: dto.addressNote,
          scheduledFor,
          notes: dto.notes,
          subtotalCents,
          deliveryFeeCents,
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

      await this.registrarEvento(pedido.tenantId, pedido.brandId, pedido.id, pedido.code, 'order.created', {
        totalCents,
        itens: linhas.length,
      });

      return this.formatarPedido(pedido);
    });
  }

  // =========================================================================
  //  LER
  // =========================================================================

  /** Acompanhamento do cliente — busca pelo código curto, sem login. */
  async buscarPorCodigoPublico(code: string) {
    // Achar o pedido é operação de sistema: ainda não sabemos o tenant.
    const cru = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, tenantId: true },
    });
    if (!cru) throw new NotFoundException('Pedido não encontrado.');

    return this.context.runAsTenant(cru.tenantId, async () => {
      const pedido = await this.tenantPrisma.db.order.findUnique({
        where: { id: cru.id },
        include: {
          items: { include: { modifiers: true } },
          payment: true,
          brand: { select: { name: true, slug: true, primaryColor: true } },
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');
      return this.formatarPedido(pedido);
    });
  }

  /** Descobre o id interno a partir do código (usado pelo tempo real). */
  async idPorCodigo(code: string) {
    const pedido = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    return pedido.id;
  }

  /** Pedidos em andamento — a tela da cozinha. */
  async listarParaCozinha() {
    const pedidos = await this.tenantPrisma.db.order.findMany({
      where: {
        status: {
          in: [
            OrderStatus.RECEIVED,
            OrderStatus.ACCEPTED,
            OrderStatus.IN_PREPARATION,
            OrderStatus.READY,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        },
      },
      include: {
        items: { include: { modifiers: true } },
        brand: { select: { name: true, primaryColor: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pedidos.map((p) => this.formatarPedido(p));
  }

  // =========================================================================
  //  MUDAR DE SITUAÇÃO
  // =========================================================================

  /**
   * Avança (ou cancela) um pedido, respeitando a máquina de estados.
   * Toda mudança grava um evento e avisa as telas abertas.
   */
  async mudarStatus(orderId: string, novo: OrderStatus, quem: string) {
    const pedido = await this.tenantPrisma.db.order.findUnique({ where: { id: orderId } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');

    if (pedido.status === novo) return this.formatarPedido(pedido);

    if (!podeIr(pedido.status, novo)) {
      throw new BadRequestException(
        `Não dá para ir de "${NOME_DO_STATUS[pedido.status]}" para "${NOME_DO_STATUS[novo]}".`,
      );
    }

    const atualizado = await this.tenantPrisma.db.order.update({
      where: { id: orderId },
      data: { status: novo },
      include: { items: { include: { modifiers: true } } },
    });

    await this.registrarEvento(
      atualizado.tenantId,
      atualizado.brandId,
      atualizado.id,
      atualizado.code,
      'order.status_changed',
      { de: pedido.status, para: novo, por: quem },
    );

    return this.formatarPedido(atualizado);
  }

  // =========================================================================
  //  CROSS-SELL  ("quem pediu isto também levou...")
  // =========================================================================

  /**
   * Sugere itens para quem já colocou algo no carrinho.
   *
   * Como funciona, em 3 tentativas:
   *   1) o que mais saiu JUNTO com esses itens em pedidos anteriores;
   *   2) se ainda não houver histórico, os mais vendidos da marca;
   *   3) se a loja for nova, qualquer item ativo do cardápio.
   */
  async sugestoes(brandSlug: string, itemIds: string[], limite = 3) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: brandSlug },
      select: { id: true, tenantId: true },
    });
    if (!brand) throw new NotFoundException('Restaurante não encontrado.');

    return this.context.runAsTenant(brand.tenantId, async () => {
      const noCarrinho = new Set(itemIds);
      const sugeridos: string[] = [];

      // 1) comprados junto
      if (itemIds.length > 0) {
        const pedidosComEsses = await this.tenantPrisma.db.orderItem.findMany({
          where: { itemId: { in: itemIds } },
          select: { orderId: true },
          take: 500,
        });
        const orderIds = [...new Set(pedidosComEsses.map((o) => o.orderId))];

        if (orderIds.length > 0) {
          const juntos = await this.tenantPrisma.db.orderItem.groupBy({
            by: ['itemId'],
            where: { orderId: { in: orderIds }, itemId: { notIn: itemIds } },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: limite,
          });
          sugeridos.push(...juntos.map((j) => j.itemId).filter((id): id is string => !!id));
        }
      }

      // 2) mais vendidos da casa
      if (sugeridos.length < limite) {
        const top = await this.tenantPrisma.db.orderItem.groupBy({
          by: ['itemId'],
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: limite * 3,
        });
        for (const t of top) {
          if (!t.itemId) continue;
          if (noCarrinho.has(t.itemId) || sugeridos.includes(t.itemId)) continue;
          sugeridos.push(t.itemId);
          if (sugeridos.length >= limite) break;
        }
      }

      // 3) qualquer coisa do cardápio (loja nova, sem histórico)
      if (sugeridos.length < limite) {
        const quaisquer = await this.tenantPrisma.db.item.findMany({
          where: {
            active: true,
            id: { notIn: [...noCarrinho, ...sugeridos] },
            category: { menu: { brandId: brand.id } },
          },
          orderBy: { priceCents: 'asc' },
          take: limite - sugeridos.length,
          select: { id: true },
        });
        sugeridos.push(...quaisquer.map((q) => q.id));
      }

      if (sugeridos.length === 0) return [];

      const itens = await this.tenantPrisma.db.item.findMany({
        where: { id: { in: sugeridos }, active: true },
        select: { id: true, name: true, priceCents: true, imageUrl: true },
      });

      // devolve na ordem em que foram sugeridos
      return sugeridos
        .map((id) => itens.find((i) => i.id === id))
        .filter((i): i is NonNullable<typeof i> => !!i);
    });
  }

  // =========================================================================
  //  Apoio
  // =========================================================================

  /**
   * Grava o evento de domínio no histórico do pedido e avisa as telas.
   *
   * Se o aviso falhar (Redis fora do ar, por exemplo), o pedido NÃO quebra —
   * o histórico já foi gravado e a tela só vai demorar um pouco mais para
   * perceber. É a "degradação graciosa" do CLAUDE.md.
   */
  async registrarEvento(
    tenantId: string,
    brandId: string,
    orderId: string,
    orderCode: string,
    type: string,
    payload?: Record<string, unknown>,
  ) {
    try {
      await this.tenantPrisma.db.orderEvent.create({
        data: { tenantId, orderId, type, payload: (payload ?? {}) as Prisma.InputJsonValue },
      });
    } catch (e) {
      this.logger.error(`Falhei ao gravar o evento ${type} do pedido ${orderCode}: ${e}`);
    }

    await this.realtime.publicar({
      tenantId,
      brandId,
      orderId,
      orderCode,
      type,
      data: payload,
      at: new Date().toISOString(),
    });
  }

  /** Sorteia um código curto que ainda não exista. */
  private async gerarCodigoUnico(tentativas = 8): Promise<string> {
    for (let i = 0; i < tentativas; i++) {
      let code = '';
      for (let c = 0; c < 6; c++) {
        code += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      }
      const existe = await this.prisma.order.findUnique({ where: { code }, select: { id: true } });
      if (!existe) return code;
    }
    throw new Error('Não consegui gerar um código de pedido único.');
  }

  /** Deixa o pedido no formato que as telas esperam. */
  private formatarPedido(p: any) {
    return {
      id: p.id,
      code: p.code,
      status: p.status,
      statusLabel: NOME_DO_STATUS[p.status as OrderStatus],
      finalizado: estaFinalizado(p.status),
      // O próximo passo vem calculado do servidor: a regra mora num lugar só,
      // e o botão da cozinha só obedece.
      proximoStatus: proximoStatus(p.status as OrderStatus),
      proximoStatusLabel: proximoStatus(p.status as OrderStatus)
        ? NOME_DO_STATUS[proximoStatus(p.status as OrderStatus) as OrderStatus]
        : null,
      channel: p.channel,
      source: p.source,
      customerName: p.customerName,
      customerPhone: p.customerPhone,
      address: {
        street: p.addressStreet,
        number: p.addressNumber,
        district: p.addressDistrict,
        city: p.addressCity,
        note: p.addressNote,
      },
      scheduledFor: p.scheduledFor,
      notes: p.notes,
      subtotalCents: p.subtotalCents,
      deliveryFeeCents: p.deliveryFeeCents,
      totalCents: p.totalCents,
      createdAt: p.createdAt,
      brand: p.brand ?? undefined,
      payment: p.payment
        ? {
            status: p.payment.status,
            method: p.payment.method,
            qrCode: p.payment.qrCode,
            amountCents: p.payment.amountCents,
            paidAt: p.payment.paidAt,
          }
        : null,
      items: (p.items ?? []).map((i: any) => ({
        id: i.id,
        name: i.nameSnapshot,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        totalCents: i.totalCents,
        notes: i.notes,
        modifiers: (i.modifiers ?? []).map((m: any) => ({
          name: m.nameSnapshot,
          priceDeltaCents: m.priceDeltaCents,
        })),
      })),
      events: (p.events ?? []).map((e: any) => ({
        type: e.type,
        payload: e.payload,
        at: e.createdAt,
      })),
    };
  }
}
