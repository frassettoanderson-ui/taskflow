import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConsentType } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';

@Injectable()
export class LgpdService {
  private readonly logger = new Logger(LgpdService.name);

  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** Registra que o cliente autorizou (ou revogou) alguma coisa. */
  async registrarConsentimento(dados: {
    customerId: string;
    type: ConsentType;
    granted: boolean;
    source: string;
  }) {
    const registro = await this.tenantPrisma.db.consentRecord.create({ data: dados as any });

    // Revogar marketing desliga as campanhas na hora.
    if (dados.type === ConsentType.MARKETING) {
      await this.tenantPrisma.db.tenantCustomer.update({
        where: { id: dados.customerId },
        data: { optOut: !dados.granted },
      });
    }

    return registro;
  }

  /** O histórico de consentimentos — a prova de que houve autorização. */
  historico(customerId: string) {
    return this.tenantPrisma.db.consentRecord.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * PORTABILIDADE: tudo que o restaurante guarda sobre esta pessoa,
   * num arquivo que ela pode levar embora.
   */
  async exportar(customerId: string) {
    const c = await this.tenantPrisma.db.tenantCustomer.findUnique({
      where: { id: customerId },
      include: {
        brand: { select: { name: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { modifiers: true } } },
        },
        cashback: { orderBy: { createdAt: 'desc' } },
        redemptions: { include: { coupon: { select: { code: true } } } },
        messages: { orderBy: { createdAt: 'desc' } },
        npsAnswers: true,
        consents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!c) throw new NotFoundException('Cliente não encontrado.');

    return {
      geradoEm: new Date().toISOString(),
      aviso:
        'Este arquivo contém todos os dados que o restaurante guarda sobre você, ' +
        'conforme o direito de portabilidade previsto na LGPD.',
      cliente: {
        nome: c.name,
        telefone: c.phone,
        marca: c.brand.name,
        clienteDesde: c.createdAt,
        pedidos: c.ordersCount,
        totalGastoCents: c.totalSpentCents,
        cashbackCents: c.cashbackBalanceCents,
        endereco: {
          rua: c.addressStreet,
          numero: c.addressNumber,
          bairro: c.addressDistrict,
          cidade: c.addressCity,
          complemento: c.addressNote,
        },
        anonimizadoEm: c.anonymizedAt,
      },
      pedidos: c.orders.map((o) => ({
        codigo: o.code,
        quando: o.createdAt,
        canal: o.channel,
        situacao: o.status,
        totalCents: o.totalCents,
        descontoCents: o.discountCents,
        cashbackUsadoCents: o.cashbackRedeemedCents,
        itens: o.items.map((i) => ({
          nome: i.nameSnapshot,
          quantidade: i.quantity,
          totalCents: i.totalCents,
          complementos: i.modifiers.map((m) => m.nameSnapshot),
        })),
      })),
      cashback: c.cashback.map((e) => ({
        tipo: e.type,
        valorCents: e.amountCents,
        descricao: e.description,
        quando: e.createdAt,
        venceEm: e.expiresAt,
      })),
      cuponsUsados: c.redemptions.map((r) => ({
        cupom: r.coupon.code,
        descontoCents: r.discountCents,
        quando: r.createdAt,
      })),
      mensagensRecebidas: c.messages.map((m) => ({
        tipo: m.kind,
        texto: m.body,
        quando: m.createdAt,
        situacao: m.status,
      })),
      avaliacoes: c.npsAnswers.map((n) => ({
        nota: n.score,
        comentario: n.comment,
        quando: n.answeredAt,
      })),
      consentimentos: c.consents.map((k) => ({
        tipo: k.type,
        autorizado: k.granted,
        origem: k.source,
        quando: k.createdAt,
      })),
    };
  }

  /**
   * DIREITO AO ESQUECIMENTO — anonimização.
   *
   * Por que anonimizar em vez de apagar: a venda em si é obrigação fiscal e
   * precisa ser guardada por anos. Então apagamos tudo que IDENTIFICA a pessoa
   * (nome, telefone, endereço, mensagens) e deixamos os valores, que passam a
   * não apontar para ninguém.
   */
  async anonimizar(customerId: string, motivo = 'Pedido do titular') {
    const c = await this.tenantPrisma.db.tenantCustomer.findUnique({ where: { id: customerId } });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    if (c.anonymizedAt) return { ok: true, jaEstava: true };

    const apelido = `anon-${c.id.slice(-6)}`;

    // 1) o cadastro
    await this.tenantPrisma.db.tenantCustomer.update({
      where: { id: customerId },
      data: {
        name: 'Cliente anônimo',
        // o telefone precisa continuar único dentro da marca
        phone: apelido,
        addressStreet: null,
        addressNumber: null,
        addressDistrict: null,
        addressCity: null,
        addressNote: null,
        optOut: true,
        anonymizedAt: new Date(),
      },
    });

    // 2) os pedidos: some quem é e onde mora, ficam os valores
    await this.tenantPrisma.db.order.updateMany({
      where: { customerId },
      data: {
        customerName: 'Cliente anônimo',
        customerPhone: apelido,
        addressStreet: null,
        addressNumber: null,
        addressNote: null,
      },
    });

    // 3) o que foi enviado para ela
    await this.tenantPrisma.db.outboundMessage.updateMany({
      where: { customerId },
      data: { to: apelido, body: '[removido a pedido do titular]' },
    });

    // 4) registra o próprio ato, para haver prova de que foi feito
    await this.tenantPrisma.db.consentRecord.create({
      data: {
        customerId,
        type: ConsentType.DATA_PROCESSING,
        granted: false,
        source: `anonimização: ${motivo}`,
      } as any,
    });

    this.logger.log(`Cliente ${customerId} anonimizado (${motivo}).`);
    return { ok: true, jaEstava: false };
  }
}
