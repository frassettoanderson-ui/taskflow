import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  ServiceCallStatus,
  ServiceCallType,
  SessionStatus,
  TableStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { OrderService } from '../order/order.service';

/** Letras e números sem os que se confundem (0/O, 1/I). */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class SalaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly realtime: RealtimeService,
    private readonly orders: OrderService,
  ) {}

  // =========================================================================
  //  MESA (lado do cliente — sem login)
  // =========================================================================

  /**
   * Descobre a mesa pelo código do QR.
   *
   * É uma operação de sistema: quem escaneia o QR não está logado, então ainda
   * não sabemos o tenant. É a MESA que nos diz de qual restaurante ela é —
   * nunca o visitante.
   */
  private async acharMesaPorToken(qrToken: string) {
    const mesa = await this.prisma.table.findUnique({
      where: { qrToken },
      include: {
        brand: {
          select: {
            id: true,
            slug: true,
            name: true,
            primaryColor: true,
            paused: true,
            pausedReason: true,
          },
        },
      },
    });
    if (!mesa || !mesa.active) throw new NotFoundException('Mesa não encontrada.');
    return mesa;
  }

  /** O que a tela do cliente sentado precisa saber. */
  async estadoDaMesaPublico(qrToken: string) {
    const mesa = await this.acharMesaPorToken(qrToken);

    return this.context.runAsTenant(mesa.tenantId, async () => {
      const comanda = await this.comandaAberta(mesa.id);

      return {
        mesa: {
          id: mesa.id,
          numero: mesa.number,
          area: mesa.area,
          lugares: mesa.seats,
          status: mesa.status,
        },
        marca: mesa.brand,
        comanda: comanda ? await this.formatarComanda(comanda.id) : null,
      };
    });
  }

  /** A comanda aberta desta mesa (ou nada, se a mesa está livre). */
  private async comandaAberta(tableId: string) {
    return this.tenantPrisma.db.tableSession.findFirst({
      where: { tableId, status: { in: [SessionStatus.OPEN, SessionStatus.CLOSING] } },
      orderBy: { openedAt: 'desc' },
    });
  }

  /**
   * Garante que exista uma comanda aberta na mesa.
   * A primeira pessoa que pede (cliente pelo QR ou garçom) é quem "abre a mesa".
   */
  private async abrirComandaSePreciso(mesa: {
    id: string;
    tenantId: string;
    unitId: string;
    brandId: string;
  }) {
    const existente = await this.comandaAberta(mesa.id);
    if (existente) return existente;

    const unidade = await this.tenantPrisma.db.unit.findUnique({
      where: { id: mesa.unitId },
      select: { serviceFeeBps: true },
    });

    const comanda = await this.tenantPrisma.db.tableSession.create({
      data: {
        tenantId: mesa.tenantId,
        unitId: mesa.unitId,
        tableId: mesa.id,
        brandId: mesa.brandId,
        code: await this.gerarCodigoDeComanda(),
        serviceFeeBps: unidade?.serviceFeeBps ?? 1000,
      },
    });

    await this.tenantPrisma.db.table.update({
      where: { id: mesa.id },
      data: { status: TableStatus.OCCUPIED },
    });

    await this.avisar(mesa.tenantId, 'table.opened', {
      tableId: mesa.id,
      sessionId: comanda.id,
    });

    return comanda;
  }

  /**
   * O cliente (ou o garçom) manda uma rodada de pedido da mesa.
   * O pedido cai no KDS na hora, marcado com o número da mesa.
   */
  async pedirNaMesa(
    qrToken: string,
    dados: {
      itens: Array<{ itemId: string; quantity: number; modifierIds?: string[]; notes?: string }>;
      nome?: string;
      notes?: string;
      pessoas?: number;
    },
    waiterId?: string,
  ) {
    const mesa = await this.acharMesaPorToken(qrToken);

    return this.context.runAsTenant(mesa.tenantId, async () => {
      if (mesa.status === TableStatus.BLOCKED) {
        throw new BadRequestException('Esta mesa está bloqueada no momento.');
      }

      // A marca pausada para tudo — inclusive o salão.
      // (Horário de funcionamento não é conferido aqui de propósito: quem está
      // sentado na mesa já foi recebido pelo restaurante.)
      if (mesa.brand.paused) {
        throw new BadRequestException(
          `${mesa.brand.name} não está aceitando pedidos: ${mesa.brand.pausedReason ?? 'pausada'}.`,
        );
      }

      const comanda = await this.abrirComandaSePreciso(mesa);

      if (comanda.status !== SessionStatus.OPEN) {
        throw new BadRequestException(
          'A conta desta mesa já foi fechada. Chame o garçom para abrir uma nova.',
        );
      }

      if (dados.pessoas && dados.pessoas > 0 && comanda.guests !== dados.pessoas) {
        await this.tenantPrisma.db.tableSession.update({
          where: { id: comanda.id },
          data: { guests: dados.pessoas },
        });
      }

      const pedido = await this.orders.criarPedidoDeMesa({
        tenantId: mesa.tenantId,
        brandId: mesa.brandId,
        unitId: mesa.unitId,
        tableId: mesa.id,
        sessionId: comanda.id,
        waiterId,
        customerName: dados.nome?.trim() || `Mesa ${mesa.number}`,
        notes: dados.notes,
        itens: dados.itens,
      });

      await this.recalcularComanda(comanda.id);
      return { pedido, comanda: await this.formatarComanda(comanda.id) };
    });
  }

  /** "Chamar garçom" ou "pedir a conta". */
  async chamar(qrToken: string, tipo: ServiceCallType, nota?: string) {
    const mesa = await this.acharMesaPorToken(qrToken);

    return this.context.runAsTenant(mesa.tenantId, async () => {
      const comanda = await this.comandaAberta(mesa.id);

      // Evita encher a tela do garçom com o mesmo chamado repetido.
      const jaExiste = await this.tenantPrisma.db.serviceCall.findFirst({
        where: { tableId: mesa.id, type: tipo, status: ServiceCallStatus.PENDING },
      });
      if (jaExiste) return { ok: true, repetido: true };

      await this.tenantPrisma.db.serviceCall.create({
        data: {
          tenantId: mesa.tenantId,
          unitId: mesa.unitId,
          tableId: mesa.id,
          sessionId: comanda?.id ?? null,
          type: tipo,
          note: nota,
        },
      });

      // Pedir a conta muda a cor da mesa no mapa — o caixa vê na hora.
      if (tipo === ServiceCallType.BILL && comanda) {
        await this.tenantPrisma.db.table.update({
          where: { id: mesa.id },
          data: { status: TableStatus.BILL_REQUESTED },
        });
      }

      await this.avisar(mesa.tenantId, 'table.call', {
        tableId: mesa.id,
        sessionId: comanda?.id,
        data: { tipo, mesa: mesa.number },
      });

      return { ok: true, repetido: false };
    });
  }

  // =========================================================================
  //  COMANDA E CONTA
  // =========================================================================

  /**
   * Recalcula os valores da comanda somando os pedidos que não foram cancelados.
   * Roda toda vez que entra uma rodada nova ou que a taxa é ligada/desligada.
   */
  async recalcularComanda(sessionId: string) {
    const comanda = await this.tenantPrisma.db.tableSession.findUnique({
      where: { id: sessionId },
      include: { orders: true, payments: true },
    });
    if (!comanda) throw new NotFoundException('Comanda não encontrada.');

    const subtotal = comanda.orders
      .filter((o) => o.status !== OrderStatus.CANCELED)
      .reduce((s, o) => s + o.subtotalCents, 0);

    const taxa = comanda.serviceFeeEnabled
      ? Math.round((subtotal * comanda.serviceFeeBps) / 10000)
      : 0;

    const pago = comanda.payments
      .filter((p) => p.status === 'PAID')
      .reduce((s, p) => s + p.amountCents, 0);

    return this.tenantPrisma.db.tableSession.update({
      where: { id: sessionId },
      data: {
        subtotalCents: subtotal,
        serviceFeeCents: taxa,
        totalCents: subtotal + taxa,
        paidCents: pago,
      },
    });
  }

  /** Liga ou desliga a taxa de serviço (o cliente pode recusar). */
  async alternarTaxaDeServico(sessionId: string, ligada: boolean) {
    await this.tenantPrisma.db.tableSession.update({
      where: { id: sessionId },
      data: { serviceFeeEnabled: ligada },
    });
    await this.recalcularComanda(sessionId);
    return this.formatarComanda(sessionId);
  }

  /** Fecha a conta: não entram mais pedidos, só falta pagar. */
  async fecharConta(sessionId: string) {
    const comanda = await this.recalcularComanda(sessionId);

    if (comanda.status === SessionStatus.PAID) {
      throw new BadRequestException('Esta conta já foi paga.');
    }
    if (comanda.totalCents <= 0) {
      throw new BadRequestException('Não há nada lançado nesta mesa.');
    }

    await this.tenantPrisma.db.tableSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.CLOSING },
    });

    await this.tenantPrisma.db.table.update({
      where: { id: comanda.tableId },
      data: { status: TableStatus.BILL_REQUESTED },
    });

    await this.avisar(comanda.tenantId, 'session.closing', {
      tableId: comanda.tableId,
      sessionId,
    });

    return this.formatarComanda(sessionId);
  }

  /** Reabre a conta (o cliente pediu mais uma coisa depois de fechar). */
  async reabrirConta(sessionId: string) {
    const comanda = await this.tenantPrisma.db.tableSession.findUnique({
      where: { id: sessionId },
    });
    if (!comanda) throw new NotFoundException('Comanda não encontrada.');
    if (comanda.status === SessionStatus.PAID) {
      throw new BadRequestException('Conta já paga — abra uma nova comanda.');
    }

    await this.tenantPrisma.db.tableSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.OPEN },
    });
    await this.tenantPrisma.db.table.update({
      where: { id: comanda.tableId },
      data: { status: TableStatus.OCCUPIED },
    });

    await this.avisar(comanda.tenantId, 'session.reopened', {
      tableId: comanda.tableId,
      sessionId,
    });
    return this.formatarComanda(sessionId);
  }

  /**
   * Quanto ainda falta pagar. É o que sustenta a divisão da conta:
   * cada parte paga vai abatendo, e quando chega a zero a mesa é liberada.
   */
  async faltaPagar(sessionId: string) {
    const comanda = await this.recalcularComanda(sessionId);
    return Math.max(0, comanda.totalCents - comanda.paidCents);
  }

  /**
   * Chamado pelo PaymentService quando um pagamento da mesa é aprovado.
   * Se a conta quitou, fecha a comanda e LIBERA A MESA sozinha.
   */
  async registrarPagamento(sessionId: string) {
    const comanda = await this.recalcularComanda(sessionId);
    const falta = Math.max(0, comanda.totalCents - comanda.paidCents);

    if (falta > 0) {
      await this.avisar(comanda.tenantId, 'session.partial_payment', {
        tableId: comanda.tableId,
        sessionId,
        data: { faltaCents: falta },
      });
      return { quitada: false, faltaCents: falta };
    }

    await this.tenantPrisma.db.tableSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.PAID, closedAt: new Date() },
    });

    // Mesa livre de novo, e os chamados pendentes dela são encerrados.
    await this.tenantPrisma.db.table.update({
      where: { id: comanda.tableId },
      data: { status: TableStatus.FREE },
    });
    await this.tenantPrisma.db.serviceCall.updateMany({
      where: { tableId: comanda.tableId, status: ServiceCallStatus.PENDING },
      data: { status: ServiceCallStatus.DONE, resolvedAt: new Date() },
    });

    await this.avisar(comanda.tenantId, 'session.paid', {
      tableId: comanda.tableId,
      sessionId,
    });

    return { quitada: true, faltaCents: 0 };
  }

  // =========================================================================
  //  MAPA DE MESAS E CHAMADOS (lado do restaurante)
  // =========================================================================

  /** O mapa de mesas, com o que está acontecendo em cada uma. */
  async mapaDeMesas() {
    const mesas = await this.tenantPrisma.db.table.findMany({
      where: { active: true },
      orderBy: [{ area: 'asc' }, { posY: 'asc' }, { posX: 'asc' }],
      include: {
        brand: { select: { id: true, name: true, primaryColor: true } },
        sessions: {
          where: { status: { in: [SessionStatus.OPEN, SessionStatus.CLOSING] } },
          orderBy: { openedAt: 'desc' },
          take: 1,
          include: { waiter: { select: { name: true } } },
        },
        calls: { where: { status: ServiceCallStatus.PENDING } },
      },
    });

    return mesas.map((m) => {
      const comanda = m.sessions[0];
      return {
        id: m.id,
        numero: m.number,
        area: m.area,
        lugares: m.seats,
        posX: m.posX,
        posY: m.posY,
        qrToken: m.qrToken,
        status: m.status,
        marca: m.brand,
        comanda: comanda
          ? {
              id: comanda.id,
              code: comanda.code,
              status: comanda.status,
              pessoas: comanda.guests,
              totalCents: comanda.totalCents,
              paidCents: comanda.paidCents,
              abertaEm: comanda.openedAt,
              garcom: comanda.waiter?.name ?? null,
            }
          : null,
        chamados: m.calls.map((c) => ({ id: c.id, tipo: c.type, criadoEm: c.createdAt })),
      };
    });
  }

  /** Chamados pendentes — a tela do garçom. */
  async chamadosPendentes() {
    const chamados = await this.tenantPrisma.db.serviceCall.findMany({
      where: { status: ServiceCallStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: { table: { select: { number: true, area: true } } },
    });

    return chamados.map((c) => ({
      id: c.id,
      tipo: c.type,
      mesa: c.table.number,
      area: c.table.area,
      nota: c.note,
      criadoEm: c.createdAt,
    }));
  }

  /** Garçom marca o chamado como atendido. */
  async atenderChamado(callId: string, userId: string) {
    const chamado = await this.tenantPrisma.db.serviceCall.findUnique({ where: { id: callId } });
    if (!chamado) throw new NotFoundException('Chamado não encontrado.');

    await this.tenantPrisma.db.serviceCall.update({
      where: { id: callId },
      data: {
        status: ServiceCallStatus.DONE,
        resolvedAt: new Date(),
        resolvedById: userId,
      },
    });

    await this.avisar(chamado.tenantId, 'table.call_done', {
      tableId: chamado.tableId,
      sessionId: chamado.sessionId ?? undefined,
    });

    return { ok: true };
  }

  /** Detalhe de uma comanda (a conta da mesa). */
  async formatarComanda(sessionId: string) {
    const c = await this.tenantPrisma.db.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: { select: { id: true, number: true, area: true, qrToken: true } },
        brand: { select: { id: true, name: true, primaryColor: true } },
        waiter: { select: { name: true } },
        orders: {
          orderBy: { createdAt: 'asc' },
          include: { items: { include: { modifiers: true } } },
        },
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Comanda não encontrada.');

    const faltaCents = Math.max(0, c.totalCents - c.paidCents);

    return {
      id: c.id,
      code: c.code,
      status: c.status,
      pessoas: c.guests,
      abertaEm: c.openedAt,
      fechadaEm: c.closedAt,
      garcom: c.waiter?.name ?? null,
      mesa: c.table,
      marca: c.brand,
      taxaDeServico: {
        ligada: c.serviceFeeEnabled,
        percentual: c.serviceFeeBps / 100,
        valorCents: c.serviceFeeCents,
      },
      subtotalCents: c.subtotalCents,
      totalCents: c.totalCents,
      paidCents: c.paidCents,
      faltaCents,
      /** as rodadas de pedido, na ordem em que foram lançadas */
      rodadas: c.orders
        .filter((o) => o.status !== OrderStatus.CANCELED)
        .map((o) => ({
          id: o.id,
          code: o.code,
          status: o.status,
          criadoEm: o.createdAt,
          porGarcom: !!o.waiterId,
          totalCents: o.subtotalCents,
          itens: o.items.map((i) => ({
            id: i.id,
            nome: i.nameSnapshot,
            quantidade: i.quantity,
            totalCents: i.totalCents,
            complementos: i.modifiers.map((m) => m.nameSnapshot),
          })),
        })),
      pagamentos: c.payments.map((p) => ({
        id: p.id,
        chargeId: p.externalId,
        status: p.status,
        amountCents: p.amountCents,
        qrCode: p.qrCode,
        pagoEm: p.paidAt,
      })),
    };
  }

  /** Abre a mesa manualmente (garçom sentando o cliente). */
  async abrirMesa(tableId: string, pessoas: number, waiterId?: string) {
    const mesa = await this.tenantPrisma.db.table.findUnique({ where: { id: tableId } });
    if (!mesa) throw new NotFoundException('Mesa não encontrada.');

    const comanda = await this.abrirComandaSePreciso({
      id: mesa.id,
      tenantId: mesa.tenantId,
      unitId: mesa.unitId,
      brandId: mesa.brandId,
    });

    await this.tenantPrisma.db.tableSession.update({
      where: { id: comanda.id },
      data: { guests: pessoas, waiterId: waiterId ?? comanda.waiterId },
    });

    return this.formatarComanda(comanda.id);
  }

  // =========================================================================
  //  FILA DE ESPERA E RESERVAS
  // =========================================================================

  /** A unidade onde fica o salão (hoje é uma só). */
  async unidadeDoSalao(): Promise<string | null> {
    const mesa = await this.tenantPrisma.db.table.findFirst({
      where: { active: true },
      select: { unitId: true },
    });
    return mesa?.unitId ?? null;
  }

  async listarFila() {
    return this.tenantPrisma.db.waitlistEntry.findMany({
      where: { status: { in: ['WAITING', 'CALLED'] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async entrarNaFila(dados: { name: string; phone: string; guests: number; unitId: string }) {
    const entrada = await this.tenantPrisma.db.waitlistEntry.create({ data: dados as any });
    await this.avisar(entrada.tenantId, 'waitlist.changed', {});
    return entrada;
  }

  async mudarFila(id: string, status: 'CALLED' | 'SEATED' | 'GAVE_UP') {
    const entrada = await this.tenantPrisma.db.waitlistEntry.update({
      where: { id },
      data: {
        status,
        calledAt: status === 'CALLED' ? new Date() : undefined,
        seatedAt: status === 'SEATED' ? new Date() : undefined,
      },
    });
    await this.avisar(entrada.tenantId, 'waitlist.changed', {});
    return entrada;
  }

  async listarReservas() {
    return this.tenantPrisma.db.reservation.findMany({
      where: { status: { in: ['CONFIRMED', 'SEATED'] } },
      orderBy: { when: 'asc' },
      include: { table: { select: { number: true } } },
    });
  }

  async criarReserva(dados: {
    name: string;
    phone: string;
    guests: number;
    when: string;
    unitId: string;
    tableId?: string;
    notes?: string;
  }) {
    const quando = new Date(dados.when);
    if (quando.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('A data da reserva já passou.');
    }

    const reserva = await this.tenantPrisma.db.reservation.create({
      data: { ...dados, when: quando } as any,
    });

    // Mesa escolhida fica marcada como reservada no mapa.
    if (dados.tableId) {
      await this.tenantPrisma.db.table.update({
        where: { id: dados.tableId },
        data: { status: TableStatus.RESERVED },
      });
    }

    await this.avisar(reserva.tenantId, 'reservation.changed', {});
    return reserva;
  }

  async mudarReserva(id: string, status: 'SEATED' | 'CANCELED' | 'NO_SHOW') {
    const reserva = await this.tenantPrisma.db.reservation.update({
      where: { id },
      data: { status },
    });

    // Some da mesa a marca de reservada, a não ser que o cliente tenha sentado.
    if (reserva.tableId) {
      await this.tenantPrisma.db.table.update({
        where: { id: reserva.tableId },
        data: { status: status === 'SEATED' ? TableStatus.OCCUPIED : TableStatus.FREE },
      });
    }

    await this.avisar(reserva.tenantId, 'reservation.changed', {});
    return reserva;
  }

  // =========================================================================
  //  Apoio
  // =========================================================================

  private async avisar(
    tenantId: string,
    type: string,
    extra: { tableId?: string; sessionId?: string; data?: Record<string, unknown> },
  ) {
    await this.realtime.publicar({
      tenantId,
      tableId: extra.tableId,
      sessionId: extra.sessionId,
      type,
      data: extra.data,
      at: new Date().toISOString(),
    });
  }

  private async gerarCodigoDeComanda(tentativas = 8): Promise<string> {
    for (let i = 0; i < tentativas; i++) {
      let code = 'M';
      for (let c = 0; c < 5; c++) {
        code += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      }
      const existe = await this.prisma.tableSession.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existe) return code;
    }
    throw new Error('Não consegui gerar um código de comanda único.');
  }
}
