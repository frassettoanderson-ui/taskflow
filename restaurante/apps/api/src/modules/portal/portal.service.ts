import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SalesChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OperationService } from '../operation/operation.service';
import { distanciaEmKm } from '../../adapters/map/fake-map.provider';
import { lerRegras } from '../order/pricing';

/**
 * A COMISSÃO DO PORTAL, embutida no preço.
 *
 * Como funciona, em português: o restaurante cadastra o prato por R$ 46,90 e é
 * isso que ele recebe. No portal, o mesmo prato aparece por R$ 52,53 — os
 * R$ 5,63 de diferença são a comissão da plataforma, paga pelo consumidor que
 * o portal trouxe.
 *
 * É o oposto do modelo de marketplace tradicional, onde a comissão sai do
 * bolso do restaurante.
 */
export function precoDoPortal(precoCents: number, comissaoBps: number): number {
  return Math.round(precoCents * (1 + comissaoBps / 10000));
}

/** Quanto daquele preço é comissão. */
export function comissaoEmbutida(precoDoPortalCents: number, precoCents: number): number {
  return Math.max(0, precoDoPortalCents - precoCents);
}

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly operacao: OperationService,
  ) {}

  // =========================================================================
  //  A PORTA DE LEITURA DO PORTAL
  // =========================================================================

  /**
   * ⚠️ ATENÇÃO — ESTA É A ÚNICA PARTE DO SISTEMA QUE LÊ VÁRIOS TENANTS.
   *
   * Todo o resto é isolado por tenant, e continua sendo. Aqui a exceção é
   * deliberada e estreita:
   *
   *   1) só marcas com PortalListing.active = true (opt-in explícito do dono);
   *   2) só campos PÚBLICOS — nome, foto, categoria, cardápio, se está aberta;
   *   3) NUNCA pedidos, clientes, financeiro ou qualquer dado de operação.
   *
   * Por isso usamos o prisma CRU aqui: o filtro é escrito à mão e visível.
   * Se alguém precisar de mais dados no portal, o lugar de discutir é este.
   */
  async vitrine(filtro: {
    busca?: string;
    categoria?: string;
    /** bairro do consumidor, para ordenar por proximidade */
    bairro?: string;
    apenasAbertas?: boolean;
  }) {
    const listagens = await this.prisma.portalListing.findMany({
      where: {
        active: true,
        ...(filtro.categoria ? { category: filtro.categoria } : {}),
        ...(filtro.busca
          ? {
              OR: [
                { brand: { name: { contains: filtro.busca, mode: 'insensitive' } } },
                { category: { contains: filtro.busca, mode: 'insensitive' } },
                { headline: { contains: filtro.busca, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      // Repare no select: nada de pedidos, clientes ou dinheiro.
      select: {
        id: true,
        tenantId: true,
        category: true,
        headline: true,
        coverUrl: true,
        commissionBps: true,
        latitude: true,
        longitude: true,
        city: true,
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
            primaryColor: true,
            logoUrl: true,
            description: true,
            paused: true,
            pausedReason: true,
          },
        },
      },
    });

    // Distância até o consumidor, se ele disse onde está.
    const origem = filtro.bairro ? await this.coordenadaDoBairro(filtro.bairro) : null;

    const marcas = await Promise.all(
      listagens.map(async (l) => {
        // "Está aberta agora?" precisa entrar no contexto daquele tenant —
        // é leitura de horário, que é dado da marca.
        const situacao = await this.context.runAsTenant(l.tenantId, () =>
          this.operacao.situacao(l.brand, SalesChannel.DELIVERY),
        );

        const distanciaKm =
          origem && l.latitude && l.longitude
            ? Math.round(distanciaEmKm(origem, { lat: l.latitude, lng: l.longitude }) * 10) / 10
            : null;

        return {
          slug: l.brand.slug,
          nome: l.brand.name,
          descricao: l.headline ?? l.brand.description,
          categoria: l.category,
          cor: l.brand.primaryColor,
          capa: l.coverUrl,
          cidade: l.city,
          distanciaKm,
          aberta: situacao.aberto,
          motivo: situacao.motivo,
          horarioDeHoje: situacao.horarioDeHoje,
        };
      }),
    );

    const filtradas = filtro.apenasAbertas ? marcas.filter((m) => m.aberta) : marcas;

    // Perto primeiro; depois abertas primeiro; depois alfabética.
    return filtradas.sort((a, b) => {
      if (a.distanciaKm != null && b.distanciaKm != null && a.distanciaKm !== b.distanciaKm) {
        return a.distanciaKm - b.distanciaKm;
      }
      if (a.aberta !== b.aberta) return a.aberta ? -1 : 1;
      return a.nome.localeCompare(b.nome);
    });
  }

  /** As categorias que existem hoje na vitrine, com a contagem. */
  async categorias() {
    const listagens = await this.prisma.portalListing.findMany({
      where: { active: true },
      select: { category: true },
    });

    const mapa = new Map<string, number>();
    for (const l of listagens) mapa.set(l.category, (mapa.get(l.category) ?? 0) + 1);

    return [...mapa.entries()]
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * O cardápio de uma marca COM OS PREÇOS DO PORTAL.
   *
   * O preço mostrado já vem com a comissão embutida, e devolvemos também o
   * preço direto — é o que alimenta o funil de graduação ("no site deles sai
   * mais barato").
   */
  async cardapioDoPortal(brandSlug: string) {
    const listagem = await this.prisma.portalListing.findFirst({
      where: { active: true, brand: { slug: brandSlug } },
      select: {
        tenantId: true,
        category: true,
        headline: true,
        commissionBps: true,
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
            primaryColor: true,
            description: true,
            paused: true,
            pausedReason: true,
          },
        },
      },
    });

    if (!listagem) throw new NotFoundException('Este restaurante não está no portal.');

    const comissaoBps = listagem.commissionBps ?? lerRegras().comissaoPortalBps;

    return this.context.runAsTenant(listagem.tenantId, async () => {
      const menu = await this.tenantPrisma.db.menu.findFirst({
        where: { brandId: listagem.brand.id, channel: SalesChannel.DELIVERY, active: true },
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
                    include: { modifiers: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
                  },
                },
              },
            },
          },
        },
      });

      if (!menu) throw new NotFoundException('Este restaurante ainda não tem cardápio de delivery.');

      const situacao = await this.operacao.situacao(listagem.brand, SalesChannel.DELIVERY);

      return {
        marca: {
          slug: listagem.brand.slug,
          nome: listagem.brand.name,
          descricao: listagem.headline ?? listagem.brand.description,
          categoria: listagem.category,
          cor: listagem.brand.primaryColor,
        },
        situacao,
        comissaoPercentual: comissaoBps / 100,
        categories: menu.categories.map((c) => ({
          id: c.id,
          name: c.name,
          items: c.items.map((i) => {
            const noPortal = precoDoPortal(i.priceCents, comissaoBps);
            return {
              id: i.id,
              name: i.name,
              description: i.description,
              /** o preço que o consumidor do portal paga */
              priceCents: noPortal,
              /** o preço no canal direto — a base do funil de graduação */
              precoDiretoCents: i.priceCents,
              imageUrl: i.imageUrl,
              disponivel: i.active,
              modifierGroups: i.modifierGroups.map((g) => ({
                id: g.id,
                name: g.name,
                minSelect: g.minSelect,
                maxSelect: g.maxSelect,
                modifiers: g.modifiers.map((m) => ({
                  id: m.id,
                  name: m.name,
                  /** o complemento também leva a comissão */
                  priceDeltaCents: precoDoPortal(m.priceDeltaCents, comissaoBps),
                  precoDiretoCents: m.priceDeltaCents,
                })),
              })),
            };
          }),
        })),
      };
    });
  }

  /** Onde fica um bairro (usa o mapa fake). */
  private async coordenadaDoBairro(bairro: string) {
    const { FakeMapProvider } = await import('../../adapters/map/fake-map.provider');
    const mapa = new FakeMapProvider();
    return mapa.geocode({ street: '', district: bairro, city: 'Imbituba', state: 'SC' });
  }

  // =========================================================================
  //  ADMINISTRAÇÃO DO OPT-IN (lado do restaurante)
  // =========================================================================

  /**
   * Confere que a marca é MESMO deste tenant.
   *
   * Sem isto, um restaurante conseguiria chamar o endereço da marca de outro.
   * Não vazaria dado (o filtro de tenant devolve vazio), mas responder "ok"
   * para algo que não é seu é ruim: confunde e esconde tentativa de abuso.
   */
  private async exigirMarcaDoTenant(brandId: string) {
    const minha = await this.tenantPrisma.db.brand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });
    if (!minha) throw new NotFoundException('Marca não encontrada.');
  }

  /** A situação da marca no portal, para o painel do restaurante. */
  async minhaListagem(brandId: string) {
    await this.exigirMarcaDoTenant(brandId);

    const l = await this.tenantPrisma.db.portalListing.findUnique({
      where: { brandId },
      include: { brand: { select: { name: true, slug: true } } },
    });

    const padrao = lerRegras().comissaoPortalBps;

    if (!l) {
      return {
        ativo: false,
        categoria: null,
        headline: null,
        comissaoPercentual: padrao / 100,
        pedidosDoPortal: 0,
      };
    }

    return {
      ativo: l.active,
      categoria: l.category,
      headline: l.headline,
      comissaoPercentual: (l.commissionBps ?? padrao) / 100,
      pedidosDoPortal: l.ordersFromPortal,
      cidade: l.city,
    };
  }

  /** Liga ou desliga a marca no portal. */
  async definirListagem(
    brandId: string,
    dados: {
      active: boolean;
      category?: string;
      headline?: string;
      commissionBps?: number;
      latitude?: number;
      longitude?: number;
      city?: string;
    },
  ) {
    await this.exigirMarcaDoTenant(brandId);

    // Ao ligar, herda a localização da cozinha se não informarem outra.
    let lat = dados.latitude;
    let lng = dados.longitude;
    let cidade = dados.city;

    if (dados.active && (lat == null || lng == null)) {
      const vinculo = await this.tenantPrisma.db.brandUnit.findFirst({
        where: { brandId, active: true },
        include: { unit: true },
      });
      lat = lat ?? vinculo?.unit.latitude ?? undefined;
      lng = lng ?? vinculo?.unit.longitude ?? undefined;
      cidade = cidade ?? vinculo?.unit.addressCity ?? undefined;
    }

    const listagem = await this.tenantPrisma.db.portalListing.upsert({
      where: { brandId },
      update: {
        active: dados.active,
        ...(dados.category ? { category: dados.category } : {}),
        ...(dados.headline !== undefined ? { headline: dados.headline } : {}),
        ...(dados.commissionBps !== undefined ? { commissionBps: dados.commissionBps } : {}),
        ...(lat != null ? { latitude: lat } : {}),
        ...(lng != null ? { longitude: lng } : {}),
        ...(cidade ? { city: cidade } : {}),
      },
      create: {
        brandId,
        active: dados.active,
        category: dados.category ?? 'Outros',
        headline: dados.headline,
        commissionBps: dados.commissionBps,
        latitude: lat,
        longitude: lng,
        city: cidade,
      } as any,
    });

    this.logger.log(
      `Marca ${brandId} ${listagem.active ? 'ENTROU' : 'SAIU'} do portal (${listagem.category}).`,
    );

    return this.minhaListagem(brandId);
  }
}
