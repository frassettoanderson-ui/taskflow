import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CampaignStatus, CustomerSegment, MessageKind } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { FILAS, QueueService } from '../../queue/queue.service';
import { MessagingService } from './messaging.service';
import { filtroDoSegmento } from './crm.service';

interface TarefaDeCampanha {
  campaignId: string;
  tenantId: string;
}

@Injectable()
export class CampaignService implements OnModuleInit {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly fila: QueueService,
    private readonly carteiro: MessagingService,
  ) {}

  onModuleInit() {
    this.fila.registrarTrabalhador(FILAS.CAMPANHAS, (job) => this.abrirCampanha(job), 2);
  }

  listar() {
    return this.tenantPrisma.db.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { brand: { select: { name: true, primaryColor: true } } },
    });
  }

  async criar(dados: {
    brandId: string;
    name: string;
    message: string;
    segment?: CustomerSegment;
    inactiveDays?: number;
  }) {
    if (!dados.message?.trim()) throw new BadRequestException('Escreva a mensagem da campanha.');

    const campanha = await this.tenantPrisma.db.campaign.create({
      data: {
        brandId: dados.brandId,
        name: dados.name,
        message: dados.message,
        segment: dados.segment ?? CustomerSegment.ALL,
        inactiveDays: dados.inactiveDays ?? 30,
      } as any,
    });

    return { ...campanha, alcance: await this.contarAlcance(campanha.id) };
  }

  /** Quantas pessoas esta campanha vai atingir (antes de disparar). */
  async contarAlcance(campaignId: string) {
    const c = await this.tenantPrisma.db.campaign.findUnique({ where: { id: campaignId } });
    if (!c) throw new NotFoundException('Campanha não encontrada.');

    return this.tenantPrisma.db.tenantCustomer.count({
      where: {
        brandId: c.brandId,
        optOut: false, // quem pediu para não receber, não recebe
        ...filtroDoSegmento(c.segment, c.inactiveDays),
      },
    });
  }

  /**
   * DISPARAR: a campanha vai para a fila.
   *
   * A tela responde na hora; quem manda de verdade é o trabalhador da fila,
   * uma mensagem de cada vez. É isso que impede um disparo para 5.000 pessoas
   * de derrubar a API.
   */
  async disparar(campaignId: string) {
    const c = await this.tenantPrisma.db.campaign.findUnique({ where: { id: campaignId } });
    if (!c) throw new NotFoundException('Campanha não encontrada.');

    if (c.status !== CampaignStatus.DRAFT && c.status !== CampaignStatus.FAILED) {
      throw new BadRequestException('Esta campanha já foi disparada.');
    }

    const alcance = await this.contarAlcance(campaignId);
    if (alcance === 0) {
      throw new BadRequestException('Nenhum cliente se encaixa neste segmento.');
    }

    await this.tenantPrisma.db.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.QUEUED, recipientCount: alcance, sentCount: 0, failedCount: 0 },
    });

    await this.fila.agendar(FILAS.CAMPANHAS, 'abrir', {
      campaignId,
      tenantId: c.tenantId,
    } satisfies TarefaDeCampanha);

    return { ok: true, alcance };
  }

  /**
   * O trabalhador: pega a campanha e a transforma em N mensagens na fila.
   * Uma tarefa vira muitas — é o "abrir o leque".
   */
  private async abrirCampanha(job: Job) {
    const { campaignId, tenantId } = job.data as TarefaDeCampanha;

    return this.context.runAsTenant(tenantId, async () => {
      const c = await this.tenantPrisma.db.campaign.findUnique({ where: { id: campaignId } });
      if (!c) return { ignorada: true };

      await this.tenantPrisma.db.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.SENDING, startedAt: new Date() },
      });

      const destinatarios = await this.tenantPrisma.db.tenantCustomer.findMany({
        where: {
          brandId: c.brandId,
          optOut: false,
          ...filtroDoSegmento(c.segment, c.inactiveDays),
        },
        select: { id: true, name: true, phone: true },
      });

      for (const d of destinatarios) {
        // Personalização simples: {nome} vira o primeiro nome do cliente.
        const texto = c.message.replace(/\{nome\}/gi, d.name.split(' ')[0] ?? 'tudo bem');

        await this.carteiro.enfileirar({
          tenantId,
          brandId: c.brandId,
          customerId: d.id,
          campaignId: c.id,
          kind: MessageKind.CAMPAIGN,
          to: d.phone,
          body: texto,
        });
      }

      this.logger.log(`Campanha "${c.name}": ${destinatarios.length} mensagens na fila.`);

      // Ninguém para receber? Fecha na hora.
      if (destinatarios.length === 0) {
        await this.tenantPrisma.db.campaign.update({
          where: { id: campaignId },
          data: { status: CampaignStatus.DONE, finishedAt: new Date() },
        });
      }

      return { enfileiradas: destinatarios.length };
    });
  }

  /** Resultado da campanha, com as mensagens. */
  async resultado(campaignId: string) {
    const c = await this.tenantPrisma.db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        brand: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: { customer: { select: { name: true } } },
        },
      },
    });
    if (!c) throw new NotFoundException('Campanha não encontrada.');
    return c;
  }
}
