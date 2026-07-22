import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AbandonedCartStatus, MessageKind } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { FILAS, QueueService } from '../../queue/queue.service';
import { MessagingService } from './messaging.service';
import { LoyaltyService, limparTelefone } from './loyalty.service';

/** Quanto tempo esperar antes de lembrar o cliente do carrinho parado. */
const MINUTOS_ATE_LEMBRAR = Number(process.env.CART_RECOVERY_MINUTES ?? 30);
/** Quanto tempo depois de entregue perguntar a nota. */
const MINUTOS_ATE_NPS = Number(process.env.NPS_DELAY_MINUTES ?? 60);

@Injectable()
export class RetentionService implements OnModuleInit {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly fila: QueueService,
    private readonly carteiro: MessagingService,
    private readonly loyalty: LoyaltyService,
  ) {}

  async onModuleInit() {
    // A faxina diária: vencer cashback e aposentar carrinho velho.
    this.fila.registrarTrabalhador(FILAS.MANUTENCAO, (job) => this.manutencao(job), 1);

    try {
      await this.fila.agendarRepetida(FILAS.MANUTENCAO, 'faxina-diaria', {}, '0 3 * * *');
    } catch (e) {
      this.logger.warn(`Não consegui agendar a faxina diária: ${e}`);
    }
  }

  // =========================================================================
  //  CARRINHO ABANDONADO
  // =========================================================================

  /**
   * A tela do cardápio avisa aqui sempre que o carrinho muda.
   *
   * Guardamos o carrinho e agendamos um lembrete. Se o cliente fechar o pedido
   * antes, marcamos como recuperado e o lembrete não é enviado.
   */
  async salvarCarrinho(dados: {
    brandSlug: string;
    clientKey: string;
    itens: unknown;
    subtotalCents: number;
    nome?: string;
    telefone?: string;
  }) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: dados.brandSlug },
      select: { id: true, tenantId: true },
    });
    if (!brand) throw new NotFoundException('Restaurante não encontrado.');

    return this.context.runAsTenant(brand.tenantId, async () => {
      const carrinho = await this.tenantPrisma.db.abandonedCart.upsert({
        where: { brandId_clientKey: { brandId: brand.id, clientKey: dados.clientKey } },
        update: {
          items: dados.itens as any,
          subtotalCents: dados.subtotalCents,
          name: dados.nome,
          phone: dados.telefone ? limparTelefone(dados.telefone) : undefined,
          status: AbandonedCartStatus.OPEN,
        },
        create: {
          tenantId: brand.tenantId,
          brandId: brand.id,
          clientKey: dados.clientKey,
          items: dados.itens as any,
          subtotalCents: dados.subtotalCents,
          name: dados.nome,
          phone: dados.telefone ? limparTelefone(dados.telefone) : undefined,
        } as any,
      });

      // Agenda (ou reagenda) o lembrete. O jobId fixo evita agendar dez vezes
      // enquanto o cliente mexe no carrinho.
      await this.fila.agendar(
        FILAS.MANUTENCAO,
        'lembrar-carrinho',
        { cartId: carrinho.id, tenantId: brand.tenantId },
        MINUTOS_ATE_LEMBRAR * 60_000,
      );

      return { ok: true, cartId: carrinho.id, lembreteEmMinutos: MINUTOS_ATE_LEMBRAR };
    });
  }

  /** O cliente fechou o pedido: o carrinho deixa de estar abandonado. */
  async marcarRecuperado(brandId: string, clientKey?: string, telefone?: string) {
    if (!clientKey && !telefone) return;

    await this.tenantPrisma.db.abandonedCart.updateMany({
      where: {
        brandId,
        status: { in: [AbandonedCartStatus.OPEN, AbandonedCartStatus.NOTIFIED] },
        ...(clientKey ? { clientKey } : { phone: limparTelefone(telefone!) }),
      },
      data: { status: AbandonedCartStatus.RECOVERED, recoveredAt: new Date() },
    });
  }

  /** Manda o lembrete, se o carrinho continuar parado. */
  private async lembrarCarrinho(cartId: string, tenantId: string) {
    return this.context.runAsTenant(tenantId, async () => {
      const carrinho = await this.tenantPrisma.db.abandonedCart.findUnique({
        where: { id: cartId },
        include: { brand: { select: { id: true, name: true, slug: true } } },
      });

      if (!carrinho) return { ignorado: 'carrinho sumiu' };
      if (carrinho.status !== AbandonedCartStatus.OPEN) {
        return { ignorado: `carrinho está ${carrinho.status}` };
      }
      if (!carrinho.phone) return { ignorado: 'não sabemos o telefone' };

      const primeiroNome = carrinho.name?.split(' ')[0] ?? 'Oi';
      const texto =
        `${primeiroNome}, você deixou um pedido pela metade na ${carrinho.brand.name} 🍽️\n` +
        `São ${(carrinho.subtotalCents / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })} esperando por você.\n` +
        `É só voltar aqui: /m/${carrinho.brand.slug}`;

      await this.carteiro.enfileirar({
        tenantId,
        brandId: carrinho.brandId,
        kind: MessageKind.CART_RECOVERY,
        to: carrinho.phone,
        body: texto,
      });

      await this.tenantPrisma.db.abandonedCart.update({
        where: { id: cartId },
        data: { status: AbandonedCartStatus.NOTIFIED, notifiedAt: new Date() },
      });

      return { lembrete: 'enviado' };
    });
  }

  /** Carrinhos parados — a tela de marketing mostra. */
  listarCarrinhos() {
    return this.tenantPrisma.db.abandonedCart.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { brand: { select: { name: true } } },
    });
  }

  // =========================================================================
  //  PESQUISA DE SATISFAÇÃO (NPS)
  // =========================================================================

  /**
   * Pedido entregue: agenda o convite da pesquisa.
   * Idempotente — se rodar duas vezes, não cria dois convites.
   */
  async agendarPesquisa(orderId: string, tenantId: string) {
    await this.fila.agendar(
      FILAS.MANUTENCAO,
      'convidar-nps',
      { orderId, tenantId },
      MINUTOS_ATE_NPS * 60_000,
    );
    return { agendadoEmMinutos: MINUTOS_ATE_NPS };
  }

  private async convidarParaPesquisa(orderId: string, tenantId: string) {
    return this.context.runAsTenant(tenantId, async () => {
      const pedido = await this.tenantPrisma.db.order.findUnique({
        where: { id: orderId },
        include: {
          brand: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true, optOut: true } },
        },
      });

      if (!pedido || !pedido.customer) return { ignorado: 'pedido sem cliente' };
      if (pedido.customer.optOut) return { ignorado: 'cliente não quer mensagens' };

      const jaTem = await this.tenantPrisma.db.npsResponse.findUnique({ where: { orderId } });
      if (jaTem) return { ignorado: 'pesquisa já criada' };

      const token = randomUUID().replace(/-/g, '').slice(0, 16);

      await this.tenantPrisma.db.npsResponse.create({
        data: {
          brandId: pedido.brandId,
          orderId,
          customerId: pedido.customer.id,
          token,
        } as any,
      });

      const primeiroNome = pedido.customer.name.split(' ')[0];
      const texto =
        `${primeiroNome}, tudo certo com seu pedido na ${pedido.brand.name}? 🙂\n` +
        `De 0 a 10, o quanto você nos indicaria a um amigo?\n` +
        `Responda em: /avaliar/${token}`;

      await this.carteiro.enfileirar({
        tenantId,
        brandId: pedido.brandId,
        customerId: pedido.customer.id,
        kind: MessageKind.NPS,
        to: pedido.customer.phone,
        body: texto,
      });

      return { convite: 'enviado', token };
    });
  }

  /** A tela pública de avaliação lê daqui. */
  async pesquisaPorToken(token: string) {
    const p = await this.prisma.npsResponse.findUnique({
      where: { token },
      include: {
        brand: { select: { name: true, primaryColor: true } },
        order: { select: { code: true } },
      },
    });
    if (!p) throw new NotFoundException('Pesquisa não encontrada.');

    return {
      token: p.token,
      marca: p.brand,
      pedido: p.order.code,
      jaRespondeu: p.answeredAt != null,
      nota: p.score,
      comentario: p.comment,
    };
  }

  /** O cliente responde (sem login). */
  async responderPesquisa(token: string, nota: number, comentario?: string) {
    const p = await this.prisma.npsResponse.findUnique({ where: { token } });
    if (!p) throw new NotFoundException('Pesquisa não encontrada.');
    if (p.answeredAt) return { ok: true, jaRespondeu: true };

    await this.prisma.npsResponse.update({
      where: { token },
      data: {
        score: Math.max(0, Math.min(10, Math.round(nota))),
        comment: comentario?.slice(0, 500),
        answeredAt: new Date(),
      },
    });

    return { ok: true, jaRespondeu: false };
  }

  /**
   * O resultado do NPS.
   *
   * A conta é a padrão do mercado: % de quem deu 9-10 (promotores) menos
   * % de quem deu 0-6 (detratores). Vai de -100 a +100.
   */
  async resultadoNps(brandId?: string) {
    const respostas = await this.tenantPrisma.db.npsResponse.findMany({
      where: { ...(brandId ? { brandId } : {}), answeredAt: { not: null } },
      orderBy: { answeredAt: 'desc' },
      take: 500,
      include: {
        customer: { select: { name: true } },
        brand: { select: { name: true } },
        order: { select: { code: true } },
      },
    });

    const total = respostas.length;
    const promotores = respostas.filter((r) => (r.score ?? 0) >= 9).length;
    const neutros = respostas.filter((r) => (r.score ?? 0) >= 7 && (r.score ?? 0) <= 8).length;
    const detratores = respostas.filter((r) => (r.score ?? 0) <= 6).length;

    const nps = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : null;

    const enviadas = await this.tenantPrisma.db.npsResponse.count({
      where: brandId ? { brandId } : {},
    });

    return {
      nps,
      total,
      enviadas,
      promotores,
      neutros,
      detratores,
      respostas: respostas.slice(0, 50).map((r) => ({
        id: r.id,
        nota: r.score,
        comentario: r.comment,
        cliente: r.customer?.name ?? '—',
        marca: r.brand.name,
        pedido: r.order.code,
        quando: r.answeredAt,
      })),
    };
  }

  // =========================================================================
  //  O trabalhador da faxina
  // =========================================================================

  private async manutencao(job: Job) {
    if (job.name === 'lembrar-carrinho') {
      const { cartId, tenantId } = job.data as { cartId: string; tenantId: string };
      return this.lembrarCarrinho(cartId, tenantId);
    }

    if (job.name === 'convidar-nps') {
      const { orderId, tenantId } = job.data as { orderId: string; tenantId: string };
      return this.convidarParaPesquisa(orderId, tenantId);
    }

    if (job.name === 'faxina-diaria') {
      const cashback = await this.loyalty.expirarVencidos();

      // Carrinho parado há mais de 7 dias vira caso perdido.
      const limite = new Date();
      limite.setDate(limite.getDate() - 7);
      const velhos = await this.prisma.abandonedCart.updateMany({
        where: {
          status: { in: [AbandonedCartStatus.OPEN, AbandonedCartStatus.NOTIFIED] },
          updatedAt: { lt: limite },
        },
        data: { status: AbandonedCartStatus.EXPIRED },
      });

      this.logger.log(
        `Faxina diária: ${cashback.expirados ?? 0} centavos de cashback vencidos, ` +
          `${velhos.count} carrinhos aposentados.`,
      );
      return { cashback, carrinhos: velhos.count };
    }

    return { ignorado: job.name };
  }
}
