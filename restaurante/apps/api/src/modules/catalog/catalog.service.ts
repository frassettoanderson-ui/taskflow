import { Injectable, NotFoundException } from '@nestjs/common';
import { SalesChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
  ) {}

  /**
   * Cardápio público de uma marca — usado pela página que o cliente abre.
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
      },
    });

    if (!brand) throw new NotFoundException('Cardápio não encontrado.');

    return this.context.runAsTenant(brand.tenantId, async () => {
      const menu = await this.tenantPrisma.db.menu.findFirst({
        where: { brandId: brand.id, channel, active: true },
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
                    include: {
                      modifiers: {
                        where: { active: true },
                        orderBy: { sortOrder: 'asc' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!menu) throw new NotFoundException('Este restaurante ainda não tem cardápio neste canal.');

      return {
        brand: {
          name: brand.name,
          slug: brand.slug,
          primaryColor: brand.primaryColor,
          logoUrl: brand.logoUrl,
          description: brand.description,
        },
        channel,
        categories: menu.categories.map((c) => ({
          id: c.id,
          name: c.name,
          items: c.items.map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            priceCents: i.priceCents,
            imageUrl: i.imageUrl,
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
}
