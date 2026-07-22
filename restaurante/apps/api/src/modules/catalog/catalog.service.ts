import { Injectable, NotFoundException } from '@nestjs/common';
import { SalesChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OperationService } from '../operation/operation.service';
import { APELIDO_DO_CANAL, NOME_DO_CANAL } from '../operation/channel';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly operacao: OperationService,
  ) {}

  /**
   * Cardápio público de uma marca EM UM CANAL.
   *
   * O caminho seguro, em duas etapas:
   *   1) descobrir de qual restaurante é este endereço (consulta de sistema)
   *   2) entrar no contexto DAQUELE tenant e só então ler o cardápio
   *
   * O visitante nunca escolhe o tenant; ele só informa o apelido da marca.
   */
  async getPublicMenu(brandSlug: string, channel: SalesChannel = SalesChannel.DELIVERY) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: brandSlug },
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        primaryColor: true,
        logoUrl: true,
        description: true,
        paused: true,
        pausedReason: true,
      },
    });

    if (!brand) throw new NotFoundException('Cardápio não encontrado.');

    return this.context.runAsTenant(brand.tenantId, async () => {
      // Em quais canais esta marca tem cardápio? (para as abas da página)
      const canais = await this.tenantPrisma.db.menu.findMany({
        where: { brandId: brand.id, active: true },
        select: { channel: true },
      });

      const menu = await this.tenantPrisma.db.menu.findFirst({
        where: { brandId: brand.id, channel, active: true },
        include: {
          categories: {
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              items: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  modifierGroups: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                      modifiers: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!menu) {
        throw new NotFoundException(
          `${brand.name} não tem cardápio de ${NOME_DO_CANAL[channel].toLowerCase()}.`,
        );
      }

      // Está aceitando pedidos agora? (pausa + horário de funcionamento)
      const situacao = await this.operacao.situacao(brand, channel);

      return {
        brand: {
          name: brand.name,
          slug: brand.slug,
          primaryColor: brand.primaryColor,
          logoUrl: brand.logoUrl,
          description: brand.description,
        },
        channel,
        channelLabel: NOME_DO_CANAL[channel],
        /** abas de canal disponíveis nesta marca */
        canais: canais.map((c) => ({
          channel: c.channel,
          apelido: APELIDO_DO_CANAL[c.channel],
          label: NOME_DO_CANAL[c.channel],
        })),
        situacao,
        categories: menu.categories.map((c) => ({
          id: c.id,
          name: c.name,
          items: c.items.map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            priceCents: i.priceCents,
            imageUrl: i.imageUrl,
            /** item pausado continua aparecendo, mas marcado como indisponível */
            disponivel: i.active,
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
    });
  }

  /** Horários e áreas de entrega — mostrado na página do cardápio. */
  async getRegrasPublicas(brandSlug: string, channel: SalesChannel) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: brandSlug },
      select: { id: true, tenantId: true, name: true },
    });
    if (!brand) throw new NotFoundException('Restaurante não encontrado.');

    return this.context.runAsTenant(brand.tenantId, async () => ({
      horarios: await this.operacao.horariosDaSemana(brand.id, channel),
      areas: await this.operacao.areasDeEntrega(brand.id, channel),
    }));
  }
}
