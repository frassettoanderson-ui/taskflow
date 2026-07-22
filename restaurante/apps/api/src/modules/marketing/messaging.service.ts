import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MessageKind, MessageStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { MESSAGING_PROVIDER, MessagingProvider } from '../../adapters/messaging/messaging.port';
import { FILAS, QueueService } from '../../queue/queue.service';

interface TarefaDeMensagem {
  messageId: string;
  tenantId: string;
}

/**
 * O CARTEIRO do sistema.
 *
 * Ninguém manda mensagem direto: todo mundo pede para o carteiro. Ele anota a
 * mensagem no banco (para você poder conferir depois), põe na fila e só então
 * entrega. Se a entrega falhar, a fila tenta de novo — e o pedido/campanha que
 * pediu não trava por causa disso.
 */
@Injectable()
export class MessagingService implements OnModuleInit {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly fila: QueueService,
    @Inject(MESSAGING_PROVIDER) private readonly whatsapp: MessagingProvider,
  ) {}

  onModuleInit() {
    this.fila.registrarTrabalhador(FILAS.MENSAGENS, (job) => this.entregar(job), 5);
  }

  /**
   * Anota a mensagem e põe na fila.
   * `atrasoMs` agenda para o futuro (carrinho abandonado, NPS).
   */
  async enfileirar(dados: {
    tenantId: string;
    brandId?: string;
    customerId?: string;
    campaignId?: string;
    kind: MessageKind;
    to: string;
    body: string;
    atrasoMs?: number;
  }) {
    const registro = await this.prisma.outboundMessage.create({
      data: {
        tenantId: dados.tenantId,
        brandId: dados.brandId,
        customerId: dados.customerId,
        campaignId: dados.campaignId,
        kind: dados.kind,
        to: dados.to,
        body: dados.body,
        status: MessageStatus.PENDING,
      },
    });

    await this.fila.agendar(
      FILAS.MENSAGENS,
      'enviar',
      { messageId: registro.id, tenantId: dados.tenantId } satisfies TarefaDeMensagem,
      dados.atrasoMs ?? 0,
    );

    return registro;
  }

  /** O trabalhador da fila: pega a mensagem anotada e entrega de verdade. */
  private async entregar(job: Job) {
    const { messageId } = job.data as TarefaDeMensagem;

    const msg = await this.prisma.outboundMessage.findUnique({ where: { id: messageId } });
    if (!msg) {
      this.logger.warn(`Mensagem ${messageId} sumiu — nada a entregar.`);
      return { ignorada: true };
    }
    // Já entregue: não manda duas vezes (a fila pode repetir a tarefa).
    if (msg.status === MessageStatus.SENT) return { repetida: true };

    try {
      const r = await this.whatsapp.send({
        tenantId: msg.tenantId,
        channel: 'WHATSAPP',
        to: msg.to,
        text: msg.body,
      });

      await this.prisma.outboundMessage.update({
        where: { id: msg.id },
        data: { status: MessageStatus.SENT, providerId: r.id, sentAt: new Date(), error: null },
      });

      if (msg.campaignId) await this.contabilizarNaCampanha(msg.campaignId, true);
      return { enviada: true };
    } catch (e: any) {
      await this.prisma.outboundMessage.update({
        where: { id: msg.id },
        data: { status: MessageStatus.FAILED, error: String(e?.message ?? e).slice(0, 300) },
      });

      if (msg.campaignId) await this.contabilizarNaCampanha(msg.campaignId, false);

      // Relança para a fila tentar de novo (3 tentativas).
      throw e;
    }
  }

  /** Vai somando o resultado na campanha e a fecha quando termina. */
  private async contabilizarNaCampanha(campaignId: string, sucesso: boolean) {
    const campanha = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: sucesso ? { sentCount: { increment: 1 } } : { failedCount: { increment: 1 } },
    });

    if (campanha.sentCount + campanha.failedCount >= campanha.recipientCount) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'DONE', finishedAt: new Date() },
      });
    }
  }

  /** Histórico do que foi enviado — a tela de Marketing lê daqui. */
  async listar(limite = 100, kind?: MessageKind) {
    return this.tenantPrisma.db.outboundMessage.findMany({
      where: kind ? { kind } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(limite, 500),
      include: { customer: { select: { name: true } } },
    });
  }
}
