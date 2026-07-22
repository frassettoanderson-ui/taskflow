import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SalesChannel } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { LimitesService } from '../portal/limites.service';
import { NOME_DO_CANAL } from '../operation/channel';

/** Transforma "Cantina da Nona" em "cantina-da-nona". */
export function paraSlug(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * O CADASTRO do cardápio.
 *
 * Até aqui, tudo vinha dos dados de exemplo. Este serviço é o que permite o
 * restaurante montar o próprio cardápio — sem ele, o sistema só funciona com
 * os dados que eu inventei.
 */
@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly limites: LimitesService,
  ) {}

  // =========================================================================
  //  MARCA
  // =========================================================================

  async criarMarca(dados: {
    name: string;
    slug?: string;
    primaryColor?: string;
    description?: string;
    logoUrl?: string;
  }) {
    // O plano permite mais uma marca? Bloquear AQUI é seguro: criar marca é
    // ato de administração, feito com calma. Nada para de vender por isto.
    const tenantId = this.context.getTenantId();
    if (tenantId) await this.limites.exigirPodeCriarMarca(tenantId);

    const slug = paraSlug(dados.slug || dados.name);
    if (!slug) throw new BadRequestException('Informe um nome válido para a marca.');

    // O slug é o endereço público — precisa ser único no sistema inteiro.
    const existe = await this.tenantPrisma.db.brand.findFirst({ where: { slug } });
    if (existe) {
      throw new BadRequestException(
        `Já existe uma marca com o endereço "/m/${slug}". Escolha outro nome.`,
      );
    }

    const marca = await this.tenantPrisma.db.brand.create({
      data: {
        name: dados.name.trim(),
        slug,
        primaryColor: dados.primaryColor || '#E11D48',
        description: dados.description,
        logoUrl: dados.logoUrl,
      } as any,
    });

    // Marca sem cardápio não serve para nada: já criamos o de delivery.
    await this.tenantPrisma.db.menu.create({
      data: {
        brandId: marca.id,
        channel: SalesChannel.DELIVERY,
        name: 'Cardápio Delivery',
      } as any,
    });

    return marca;
  }

  async atualizarMarca(
    id: string,
    dados: Partial<{
      name: string;
      primaryColor: string;
      description: string;
      logoUrl: string;
    }>,
  ) {
    await this.exigirMinha(id);
    return this.tenantPrisma.db.brand.update({ where: { id }, data: dados });
  }

  /** Garante que a marca é deste tenant (o filtro devolve vazio se não for). */
  private async exigirMinha(brandId: string) {
    const m = await this.tenantPrisma.db.brand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });
    if (!m) throw new NotFoundException('Marca não encontrada.');
  }

  // =========================================================================
  //  CARDÁPIO (menu de um canal)
  // =========================================================================

  /** Os cardápios de uma marca, um por canal. */
  async cardapiosDaMarca(brandId: string) {
    await this.exigirMinha(brandId);

    const menus = await this.tenantPrisma.db.menu.findMany({
      where: { brandId },
      orderBy: { channel: 'asc' },
      include: { _count: { select: { categories: true } } },
    });

    return menus.map((m) => ({
      id: m.id,
      channel: m.channel,
      channelLabel: NOME_DO_CANAL[m.channel],
      name: m.name,
      active: m.active,
      categorias: m._count.categories,
    }));
  }

  /** Cria o cardápio de um canal que ainda não tem. */
  async criarCardapio(brandId: string, channel: SalesChannel, name?: string) {
    await this.exigirMinha(brandId);

    const existe = await this.tenantPrisma.db.menu.findFirst({ where: { brandId, channel } });
    if (existe) throw new BadRequestException('Esta marca já tem cardápio neste canal.');

    return this.tenantPrisma.db.menu.create({
      data: {
        brandId,
        channel,
        name: name || `Cardápio ${NOME_DO_CANAL[channel]}`,
      } as any,
    });
  }

  /**
   * O cardápio inteiro para o editor: categorias, itens e complementos.
   * Traz também os itens PAUSADOS — quem edita precisa ver tudo.
   */
  async cardapioCompleto(menuId: string) {
    const menu = await this.tenantPrisma.db.menu.findUnique({
      where: { id: menuId },
      include: {
        brand: { select: { id: true, name: true, slug: true, primaryColor: true } },
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
              include: {
                station: { select: { id: true, name: true } },
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

    if (!menu) throw new NotFoundException('Cardápio não encontrado.');

    return {
      id: menu.id,
      channel: menu.channel,
      channelLabel: NOME_DO_CANAL[menu.channel],
      name: menu.name,
      active: menu.active,
      marca: menu.brand,
      categorias: menu.categories.map((c) => ({
        id: c.id,
        nome: c.name,
        ordem: c.sortOrder,
        ativa: c.active,
        itens: c.items.map((i) => ({
          id: i.id,
          nome: i.name,
          descricao: i.description,
          precoCents: i.priceCents,
          imagemUrl: i.imageUrl,
          ordem: i.sortOrder,
          ativo: i.active,
          estacao: i.station,
          grupos: i.modifierGroups.map((g) => ({
            id: g.id,
            nome: g.name,
            minimo: g.minSelect,
            maximo: g.maxSelect,
            ordem: g.sortOrder,
            opcoes: g.modifiers.map((m) => ({
              id: m.id,
              nome: m.name,
              acrescimoCents: m.priceDeltaCents,
              ativo: m.active,
            })),
          })),
        })),
      })),
    };
  }

  // ------------------------------------------------------------ categoria ---

  async criarCategoria(menuId: string, name: string) {
    const menu = await this.tenantPrisma.db.menu.findUnique({ where: { id: menuId } });
    if (!menu) throw new NotFoundException('Cardápio não encontrado.');

    const ultima = await this.tenantPrisma.db.category.findFirst({
      where: { menuId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.tenantPrisma.db.category.create({
      data: { menuId, name: name.trim(), sortOrder: (ultima?.sortOrder ?? -1) + 1 } as any,
    });
  }

  atualizarCategoria(id: string, dados: Partial<{ name: string; active: boolean }>) {
    return this.tenantPrisma.db.category.update({ where: { id }, data: dados });
  }

  /** Sobe ou desce a categoria trocando de lugar com a vizinha. */
  async moverCategoria(id: string, direcao: 'cima' | 'baixo') {
    const atual = await this.tenantPrisma.db.category.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Categoria não encontrada.');

    const vizinha = await this.tenantPrisma.db.category.findFirst({
      where: {
        menuId: atual.menuId,
        sortOrder: direcao === 'cima' ? { lt: atual.sortOrder } : { gt: atual.sortOrder },
      },
      orderBy: { sortOrder: direcao === 'cima' ? 'desc' : 'asc' },
    });

    if (!vizinha) return { movida: false, motivo: 'já está na ponta' };

    await this.tenantPrisma.db.category.update({
      where: { id: atual.id },
      data: { sortOrder: vizinha.sortOrder },
    });
    await this.tenantPrisma.db.category.update({
      where: { id: vizinha.id },
      data: { sortOrder: atual.sortOrder },
    });

    return { movida: true };
  }

  /**
   * Apagar categoria leva os itens junto.
   * Se algum item já foi vendido, o pedido antigo NÃO se perde: ele guarda
   * cópia do nome e do preço desde a Etapa 1.
   */
  async apagarCategoria(id: string) {
    const itens = await this.tenantPrisma.db.item.count({ where: { categoryId: id } });
    await this.tenantPrisma.db.category.delete({ where: { id } });
    return { apagada: true, itensApagados: itens };
  }

  // ----------------------------------------------------------------- item ---

  async criarItem(dados: {
    categoryId: string;
    name: string;
    description?: string;
    priceCents: number;
    imageUrl?: string;
    stationId?: string;
  }) {
    if (dados.priceCents < 0) throw new BadRequestException('O preço não pode ser negativo.');

    const categoria = await this.tenantPrisma.db.category.findUnique({
      where: { id: dados.categoryId },
    });
    if (!categoria) throw new NotFoundException('Categoria não encontrada.');

    const ultimo = await this.tenantPrisma.db.item.findFirst({
      where: { categoryId: dados.categoryId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.tenantPrisma.db.item.create({
      data: {
        categoryId: dados.categoryId,
        name: dados.name.trim(),
        description: dados.description,
        priceCents: dados.priceCents,
        imageUrl: dados.imageUrl,
        stationId: dados.stationId || null,
        sortOrder: (ultimo?.sortOrder ?? -1) + 1,
      } as any,
    });
  }

  atualizarItem(
    id: string,
    dados: Partial<{
      name: string;
      description: string;
      priceCents: number;
      imageUrl: string;
      stationId: string | null;
      active: boolean;
    }>,
  ) {
    return this.tenantPrisma.db.item.update({ where: { id }, data: dados });
  }

  async moverItem(id: string, direcao: 'cima' | 'baixo') {
    const atual = await this.tenantPrisma.db.item.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Item não encontrado.');

    const vizinho = await this.tenantPrisma.db.item.findFirst({
      where: {
        categoryId: atual.categoryId,
        sortOrder: direcao === 'cima' ? { lt: atual.sortOrder } : { gt: atual.sortOrder },
      },
      orderBy: { sortOrder: direcao === 'cima' ? 'desc' : 'asc' },
    });

    if (!vizinho) return { movido: false };

    await this.tenantPrisma.db.item.update({
      where: { id: atual.id },
      data: { sortOrder: vizinho.sortOrder },
    });
    await this.tenantPrisma.db.item.update({
      where: { id: vizinho.id },
      data: { sortOrder: atual.sortOrder },
    });

    return { movido: true };
  }

  apagarItem(id: string) {
    return this.tenantPrisma.db.item.delete({ where: { id } });
  }

  /** Duplica um item com todos os complementos — poupa muito trabalho. */
  async duplicarItem(id: string) {
    const original = await this.tenantPrisma.db.item.findUnique({
      where: { id },
      include: { modifierGroups: { include: { modifiers: true } } },
    });
    if (!original) throw new NotFoundException('Item não encontrado.');

    const copia = await this.criarItem({
      categoryId: original.categoryId,
      name: `${original.name} (cópia)`,
      description: original.description ?? undefined,
      priceCents: original.priceCents,
      imageUrl: original.imageUrl ?? undefined,
      stationId: original.stationId ?? undefined,
    });

    for (const g of original.modifierGroups) {
      const grupo = await this.criarGrupo({
        itemId: copia.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
      });
      for (const m of g.modifiers) {
        await this.criarOpcao({
          groupId: grupo.id,
          name: m.name,
          priceDeltaCents: m.priceDeltaCents,
        });
      }
    }

    return copia;
  }

  // ------------------------------------------------- grupos de complemento ---

  async criarGrupo(dados: {
    itemId: string;
    name: string;
    minSelect: number;
    maxSelect: number;
  }) {
    if (dados.maxSelect < 1) throw new BadRequestException('O máximo precisa ser pelo menos 1.');
    if (dados.minSelect > dados.maxSelect) {
      throw new BadRequestException('O mínimo não pode ser maior que o máximo.');
    }

    const ultimo = await this.tenantPrisma.db.modifierGroup.findFirst({
      where: { itemId: dados.itemId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.tenantPrisma.db.modifierGroup.create({
      data: { ...dados, name: dados.name.trim(), sortOrder: (ultimo?.sortOrder ?? -1) + 1 } as any,
    });
  }

  async atualizarGrupo(
    id: string,
    dados: Partial<{ name: string; minSelect: number; maxSelect: number }>,
  ) {
    const atual = await this.tenantPrisma.db.modifierGroup.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Grupo não encontrado.');

    const min = dados.minSelect ?? atual.minSelect;
    const max = dados.maxSelect ?? atual.maxSelect;
    if (min > max) throw new BadRequestException('O mínimo não pode ser maior que o máximo.');

    return this.tenantPrisma.db.modifierGroup.update({ where: { id }, data: dados });
  }

  apagarGrupo(id: string) {
    return this.tenantPrisma.db.modifierGroup.delete({ where: { id } });
  }

  async criarOpcao(dados: { groupId: string; name: string; priceDeltaCents: number }) {
    const ultima = await this.tenantPrisma.db.modifier.findFirst({
      where: { groupId: dados.groupId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.tenantPrisma.db.modifier.create({
      data: { ...dados, name: dados.name.trim(), sortOrder: (ultima?.sortOrder ?? -1) + 1 } as any,
    });
  }

  atualizarOpcao(
    id: string,
    dados: Partial<{ name: string; priceDeltaCents: number; active: boolean }>,
  ) {
    return this.tenantPrisma.db.modifier.update({ where: { id }, data: dados });
  }

  apagarOpcao(id: string) {
    return this.tenantPrisma.db.modifier.delete({ where: { id } });
  }

  // =========================================================================
  //  COPIAR CARDÁPIO ENTRE CANAIS
  // =========================================================================

  /**
   * Copia o cardápio de um canal para outro, com ajuste de preço.
   *
   * Serve para o caso comum: o salão é o delivery com 15% a mais. Fazer isso
   * à mão, prato por prato, seria o trabalho mais chato do mundo.
   */
  async copiarCardapio(dados: {
    origemMenuId: string;
    destinoMenuId: string;
    /** 15 = 15% mais caro; -10 = 10% mais barato; 0 = mesmo preço */
    ajustePercentual: number;
  }) {
    const origem = await this.tenantPrisma.db.menu.findUnique({
      where: { id: dados.origemMenuId },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
              include: { modifierGroups: { include: { modifiers: true } } },
            },
          },
        },
      },
    });
    if (!origem) throw new NotFoundException('Cardápio de origem não encontrado.');

    const destino = await this.tenantPrisma.db.menu.findUnique({
      where: { id: dados.destinoMenuId },
      include: { _count: { select: { categories: true } } },
    });
    if (!destino) throw new NotFoundException('Cardápio de destino não encontrado.');

    if (destino._count.categories > 0) {
      throw new BadRequestException(
        'O cardápio de destino já tem categorias. Apague antes de copiar, para não misturar.',
      );
    }

    const fator = 1 + dados.ajustePercentual / 100;
    let itensCopiados = 0;

    for (const c of origem.categories) {
      const novaCategoria = await this.criarCategoria(destino.id, c.name);

      for (const i of c.items) {
        const novoItem = await this.criarItem({
          categoryId: novaCategoria.id,
          name: i.name,
          description: i.description ?? undefined,
          priceCents: Math.round(i.priceCents * fator),
          imageUrl: i.imageUrl ?? undefined,
          stationId: i.stationId ?? undefined,
        });
        itensCopiados++;

        for (const g of i.modifierGroups) {
          const novoGrupo = await this.criarGrupo({
            itemId: novoItem.id,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
          });
          for (const m of g.modifiers) {
            await this.criarOpcao({
              groupId: novoGrupo.id,
              name: m.name,
              priceDeltaCents: Math.round(m.priceDeltaCents * fator),
            });
          }
        }
      }
    }

    return {
      copiado: true,
      categorias: origem.categories.length,
      itens: itensCopiados,
      ajuste: `${dados.ajustePercentual > 0 ? '+' : ''}${dados.ajustePercentual}%`,
    };
  }
}
