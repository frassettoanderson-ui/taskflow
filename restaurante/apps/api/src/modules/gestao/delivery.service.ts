import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CourierPayModel,
  DispatchStatus,
  EntryStatus,
  EntryType,
  PayoutKind,
  PayoutStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { DELIVERY_PROVIDER, DeliveryProvider } from '../../adapters/delivery/delivery.port';
import { MAP_PROVIDER, MapProvider } from '../../adapters/map/map.port';
import { distanciaEmKm } from '../../adapters/map/fake-map.provider';
import { lerRegras } from '../order/pricing';
import { fimDoDia, inicioDoDia } from '../../common/datas';

/** Letras e números sem os que se confundem. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(DELIVERY_PROVIDER) private readonly despachante: DeliveryProvider,
    @Inject(MAP_PROVIDER) private readonly mapa: MapProvider,
  ) {}

  // =========================================================================
  //  ENTREGADORES
  // =========================================================================

  async listarEntregadores() {
    const couriers = await this.tenantPrisma.db.courier.findMany({
      orderBy: { name: 'asc' },
      include: {
        dispatches: {
          where: { status: { in: [DispatchStatus.ASSIGNED, DispatchStatus.PICKED_UP] } },
          select: { id: true },
        },
      },
    });

    return couriers.map((c) => ({
      id: c.id,
      nome: c.name,
      telefone: c.phone,
      veiculo: c.vehicle,
      formaDePagamento: c.payModel,
      formaLabel:
        c.payModel === CourierPayModel.FIXED_PER_DELIVERY
          ? `${(c.fixedPayCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por entrega`
          : 'Fatia do frete',
      fixedPayCents: c.fixedPayCents,
      ativo: c.active,
      /** quantas corridas ele tem na mão agora */
      emRota: c.dispatches.length,
    }));
  }

  criarEntregador(dados: {
    name: string;
    phone: string;
    vehicle?: string;
    payModel?: CourierPayModel;
    fixedPayCents?: number;
    unitId?: string;
  }) {
    return this.tenantPrisma.db.courier.create({ data: dados as any });
  }

  atualizarEntregador(
    id: string,
    dados: Partial<{ name: string; phone: string; vehicle: string; payModel: CourierPayModel; fixedPayCents: number; active: boolean }>,
  ) {
    return this.tenantPrisma.db.courier.update({ where: { id }, data: dados });
  }

  // =========================================================================
  //  DESPACHO
  // =========================================================================

  /**
   * Quanto o entregador recebe por esta corrida.
   *
   * Duas formas, escolhidas por entregador:
   *  - FATIA DO FRETE: a regra da Etapa 1 — a plataforma retém 10% e o
   *    entregador leva o resto;
   *  - VALOR FIXO: típico de frota própria, o mesmo por corrida.
   */
  private calcularPagamento(
    courier: { payModel: CourierPayModel; fixedPayCents: number },
    deliveryFeeCents: number,
  ) {
    if (courier.payModel === CourierPayModel.FIXED_PER_DELIVERY) {
      return courier.fixedPayCents;
    }
    const regras = lerRegras();
    const retido = Math.round((deliveryFeeCents * regras.taxaSobreEntregaBps) / 10000);
    return Math.max(0, deliveryFeeCents - retido);
  }

  /** Atribui um pedido a um entregador. */
  async atribuir(orderId: string, courierId: string) {
    const pedido = await this.tenantPrisma.db.order.findUnique({
      where: { id: orderId },
      include: {
        dispatch: true,
        unit: { select: { latitude: true, longitude: true, addressStreet: true, addressNumber: true } },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');

    if (pedido.dispatch && pedido.dispatch.status !== DispatchStatus.CANCELED) {
      throw new BadRequestException('Este pedido já tem entregador.');
    }

    const courier = await this.tenantPrisma.db.courier.findUnique({ where: { id: courierId } });
    if (!courier) throw new NotFoundException('Entregador não encontrado.');
    if (!courier.active) throw new BadRequestException('Este entregador está inativo.');

    // Distância pelo MapProvider (hoje fake, em linha reta).
    let distanciaKm: number | null = null;
    if (pedido.unit?.latitude && pedido.unit?.longitude) {
      const destino = await this.mapa.geocode({
        street: pedido.addressStreet ?? '',
        number: pedido.addressNumber ?? undefined,
        district: pedido.addressDistrict ?? undefined,
        city: pedido.addressCity ?? '',
        state: 'SC',
      });
      if (destino) {
        distanciaKm =
          Math.round(
            distanciaEmKm({ lat: pedido.unit.latitude, lng: pedido.unit.longitude }, destino) * 100,
          ) / 100;
      }
    }

    const pagamento = this.calcularPagamento(courier, pedido.deliveryFeeCents);

    // Avisa o serviço de despacho (fake por enquanto).
    const corrida = await this.despachante.dispatch({
      tenantId: pedido.tenantId,
      orderId: pedido.code,
      pickup: {
        lat: pedido.unit?.latitude ?? 0,
        lng: pedido.unit?.longitude ?? 0,
        address: `${pedido.unit?.addressStreet ?? 'Cozinha'}, ${pedido.unit?.addressNumber ?? ''}`,
      },
      dropoff: {
        lat: 0,
        lng: 0,
        address: `${pedido.addressStreet}, ${pedido.addressNumber} — ${pedido.addressDistrict}`,
      },
      courierPayoutCents: pagamento,
    });

    const trackingCode = await this.gerarCodigoDeRastreio();

    const dispatch = await this.tenantPrisma.db.dispatch.upsert({
      where: { orderId },
      update: {
        courierId,
        status: DispatchStatus.ASSIGNED,
        externalId: corrida.id,
        distanceKm: distanciaKm,
        courierPayoutCents: pagamento,
        assignedAt: new Date(),
        canceledAt: null,
      },
      create: {
        orderId,
        courierId,
        status: DispatchStatus.ASSIGNED,
        externalId: corrida.id,
        trackingCode,
        distanceKm: distanciaKm,
        courierPayoutCents: pagamento,
        assignedAt: new Date(),
      } as any,
    });

    this.logger.log(
      `Pedido ${pedido.code} com ${courier.name} — ${distanciaKm ?? '?'} km, ` +
        `${pagamento} centavos.`,
    );

    return this.formatarDispatch(dispatch.id);
  }

  /** Avança a corrida: saiu, entregou, cancelou. */
  async mudarStatus(dispatchId: string, novo: DispatchStatus) {
    const d = await this.tenantPrisma.db.dispatch.findUnique({ where: { id: dispatchId } });
    if (!d) throw new NotFoundException('Corrida não encontrada.');

    const carimbo: Record<string, Date> = {};
    if (novo === DispatchStatus.PICKED_UP) carimbo.pickedUpAt = new Date();
    if (novo === DispatchStatus.DELIVERED) carimbo.deliveredAt = new Date();
    if (novo === DispatchStatus.CANCELED) carimbo.canceledAt = new Date();

    await this.tenantPrisma.db.dispatch.update({
      where: { id: dispatchId },
      data: { status: novo, ...carimbo },
    });

    return this.formatarDispatch(dispatchId);
  }

  /** Corridas em andamento — a tela de entregas. */
  async listarCorridas(status?: DispatchStatus) {
    const corridas = await this.tenantPrisma.db.dispatch.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        courier: { select: { id: true, name: true, phone: true, vehicle: true } },
        order: {
          select: {
            code: true,
            customerName: true,
            addressStreet: true,
            addressNumber: true,
            addressDistrict: true,
            totalCents: true,
            deliveryFeeCents: true,
            status: true,
            brand: { select: { name: true, primaryColor: true } },
          },
        },
      },
    });

    return corridas.map((d) => this.mapearDispatch(d));
  }

  /** Pedidos prontos esperando entregador. */
  async pedidosSemEntregador() {
    const pedidos = await this.tenantPrisma.db.order.findMany({
      where: {
        channel: 'DELIVERY',
        status: { in: ['ACCEPTED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY'] },
        dispatch: { is: null },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        code: true,
        status: true,
        customerName: true,
        addressStreet: true,
        addressNumber: true,
        addressDistrict: true,
        deliveryFeeCents: true,
        totalCents: true,
        createdAt: true,
        brand: { select: { name: true, primaryColor: true } },
      },
    });

    return pedidos;
  }

  private async formatarDispatch(id: string) {
    const d = await this.tenantPrisma.db.dispatch.findUnique({
      where: { id },
      include: {
        courier: { select: { id: true, name: true, phone: true, vehicle: true } },
        order: {
          select: {
            code: true,
            customerName: true,
            addressStreet: true,
            addressNumber: true,
            addressDistrict: true,
            totalCents: true,
            deliveryFeeCents: true,
            status: true,
            brand: { select: { name: true, primaryColor: true } },
          },
        },
      },
    });
    if (!d) throw new NotFoundException('Corrida não encontrada.');
    return this.mapearDispatch(d);
  }

  private mapearDispatch(d: any) {
    return {
      id: d.id,
      status: d.status,
      rastreio: d.trackingCode,
      distanciaKm: d.distanceKm,
      pagamentoCents: d.courierPayoutCents,
      entregador: d.courier,
      pedido: d.order,
      atribuidoEm: d.assignedAt,
      saiuEm: d.pickedUpAt,
      entregueEm: d.deliveredAt,
      acertado: !!d.payoutId,
    };
  }

  /** Rastreio público, pelo código curto. */
  async rastrear(trackingCode: string) {
    const d = await this.prisma.dispatch.findUnique({
      where: { trackingCode: trackingCode.toUpperCase() },
      include: {
        courier: { select: { name: true, vehicle: true } },
        order: { select: { code: true, status: true, brand: { select: { name: true, primaryColor: true } } } },
      },
    });
    if (!d) throw new NotFoundException('Entrega não encontrada.');

    return {
      rastreio: d.trackingCode,
      status: d.status,
      entregador: d.courier ? { nome: d.courier.name, veiculo: d.courier.vehicle } : null,
      distanciaKm: d.distanceKm,
      pedido: d.order.code,
      marca: d.order.brand,
      saiuEm: d.pickedUpAt,
      entregueEm: d.deliveredAt,
    };
  }

  // =========================================================================
  //  ACERTO (motoboy e garçom)
  // =========================================================================

  /**
   * Fecha o acerto de um entregador num período.
   *
   * Junta as corridas entregues que ainda não entraram em nenhum acerto, soma
   * o que ele tem a receber e gera a CONTA A PAGAR correspondente.
   */
  async fecharAcertoDeEntregador(courierId: string, de: string, ate: string) {
    const inicio = inicioDoDia(de);
    const fim = fimDoDia(ate);

    const courier = await this.tenantPrisma.db.courier.findUnique({ where: { id: courierId } });
    if (!courier) throw new NotFoundException('Entregador não encontrado.');

    const corridas = await this.tenantPrisma.db.dispatch.findMany({
      where: {
        courierId,
        status: DispatchStatus.DELIVERED,
        payoutId: null,
        deliveredAt: { gte: inicio, lte: fim },
      },
    });

    if (corridas.length === 0) {
      throw new BadRequestException('Nenhuma entrega para acertar neste período.');
    }

    const total = corridas.reduce((s, c) => s + c.courierPayoutCents, 0);

    const acerto = await this.tenantPrisma.db.payout.create({
      data: {
        kind: PayoutKind.COURIER,
        courierId,
        periodFrom: inicio,
        periodTo: fim,
        itemsCount: corridas.length,
        amountCents: total,
      } as any,
    });

    await this.tenantPrisma.db.dispatch.updateMany({
      where: { id: { in: corridas.map((c) => c.id) } },
      data: { payoutId: acerto.id },
    });

    // Vira conta a pagar automaticamente.
    await this.tenantPrisma.db.accountEntry.create({
      data: {
        type: EntryType.PAYABLE,
        status: EntryStatus.OPEN,
        category: 'Acerto de motoboy',
        description: `${courier.name} — ${corridas.length} entregas`,
        amountCents: total,
        dueDate: new Date(),
        party: courier.name,
        payoutId: acerto.id,
      } as any,
    });

    return { ...acerto, entregas: corridas.length, entregador: courier.name };
  }

  /**
   * Acerto do garçom: soma os pedidos que ele lançou no período.
   *
   * A taxa de serviço de 10% é o que costuma ser rateado entre a equipe —
   * aqui calculamos a parte dele sobre o que ele mesmo lançou.
   */
  async fecharAcertoDeGarcom(userId: string, de: string, ate: string, percentualDaTaxa = 100) {
    const inicio = inicioDoDia(de);
    const fim = fimDoDia(ate);

    const garcom = await this.tenantPrisma.db.user.findUnique({ where: { id: userId } });
    if (!garcom) throw new NotFoundException('Usuário não encontrado.');

    const pedidos = await this.tenantPrisma.db.order.findMany({
      where: {
        waiterId: userId,
        status: { not: 'CANCELED' },
        createdAt: { gte: inicio, lte: fim },
      },
      select: { id: true, subtotalCents: true, tableSession: { select: { serviceFeeBps: true, serviceFeeEnabled: true } } },
    });

    if (pedidos.length === 0) {
      throw new BadRequestException('Nenhum pedido deste garçom no período.');
    }

    let total = 0;
    for (const p of pedidos) {
      const bps = p.tableSession?.serviceFeeEnabled ? (p.tableSession.serviceFeeBps ?? 1000) : 0;
      const taxa = Math.round((p.subtotalCents * bps) / 10000);
      total += Math.round((taxa * percentualDaTaxa) / 100);
    }

    const acerto = await this.tenantPrisma.db.payout.create({
      data: {
        kind: PayoutKind.WAITER,
        userId,
        periodFrom: inicio,
        periodTo: fim,
        itemsCount: pedidos.length,
        amountCents: total,
        notes: `${percentualDaTaxa}% da taxa de serviço dos pedidos lançados`,
      } as any,
    });

    await this.tenantPrisma.db.accountEntry.create({
      data: {
        type: EntryType.PAYABLE,
        status: EntryStatus.OPEN,
        category: 'Acerto de garçom',
        description: `${garcom.name} — ${pedidos.length} pedidos`,
        amountCents: total,
        dueDate: new Date(),
        party: garcom.name,
        payoutId: acerto.id,
      } as any,
    });

    return { ...acerto, pedidos: pedidos.length, garcom: garcom.name };
  }

  async listarAcertos() {
    const acertos = await this.tenantPrisma.db.payout.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        courier: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    return acertos.map((a) => ({
      id: a.id,
      tipo: a.kind,
      quem: a.courier?.name ?? a.user?.name ?? '—',
      de: a.periodFrom,
      ate: a.periodTo,
      itens: a.itemsCount,
      valorCents: a.amountCents,
      status: a.status,
      pagoEm: a.paidAt,
    }));
  }

  async pagarAcerto(id: string) {
    await this.tenantPrisma.db.payout.update({
      where: { id },
      data: { status: PayoutStatus.PAID, paidAt: new Date() },
    });

    await this.tenantPrisma.db.accountEntry.updateMany({
      where: { payoutId: id, status: EntryStatus.OPEN },
      data: { status: EntryStatus.PAID, paidAt: new Date() },
    });

    return { ok: true };
  }

  private async gerarCodigoDeRastreio(tentativas = 8): Promise<string> {
    for (let i = 0; i < tentativas; i++) {
      let code = 'E';
      for (let c = 0; c < 6; c++) code += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      const existe = await this.prisma.dispatch.findUnique({
        where: { trackingCode: code },
        select: { id: true },
      });
      if (!existe) return code;
    }
    throw new Error('Não consegui gerar um código de rastreio único.');
  }
}
