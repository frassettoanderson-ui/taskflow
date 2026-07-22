import { Injectable, NotFoundException } from '@nestjs/common';
import { SalesChannel } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { OperationService } from '../operation/operation.service';
import { APELIDO_DO_CANAL, NOME_DO_CANAL } from '../operation/channel';

/**
 * Marcas do tenant logado.
 *
 * Repare que NENHUM método aqui escreve "tenantId" — quem cuida disso é o
 * TenantPrismaService. É esse o desenho: o programador não pode esquecer,
 * porque não é ele quem faz.
 */
@Injectable()
export class BrandService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly operacao: OperationService,
  ) {}

  list() {
    return this.tenantPrisma.db.brand.findMany({ orderBy: { name: 'asc' } });
  }

  /**
   * Marcas com a situação de cada uma AGORA — é o que o painel mostra:
   * quais canais ela tem, se está pausada e se está dentro do horário.
   */
  async listComSituacao() {
    const marcas = await this.tenantPrisma.db.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        menus: { where: { active: true }, select: { channel: true } },
      },
    });

    return Promise.all(
      marcas.map(async (m) => {
        const canais = await Promise.all(
          m.menus.map(async (menu) => {
            const s = await this.operacao.situacao(m, menu.channel);
            return {
              channel: menu.channel,
              apelido: APELIDO_DO_CANAL[menu.channel],
              label: NOME_DO_CANAL[menu.channel],
              aberto: s.aberto,
              motivo: s.motivo,
              horarioDeHoje: s.horarioDeHoje,
            };
          }),
        );

        return {
          id: m.id,
          name: m.name,
          slug: m.slug,
          primaryColor: m.primaryColor,
          description: m.description,
          paused: m.paused,
          pausedReason: m.pausedReason,
          canais: canais.sort((a, b) => a.label.localeCompare(b.label)),
        };
      }),
    );
  }

  /**
   * Busca uma marca pelo id.
   *
   * Se o id for de outra empresa, o filtro de tenant faz a busca não achar nada
   * e devolvemos "não encontrado" — que é a resposta certa: nem confirmamos
   * que aquele id existe em algum lugar.
   */
  async findOne(id: string) {
    const brand = await this.tenantPrisma.db.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Marca não encontrada.');
    return brand;
  }

  /** Regras de operação da marca: horários e área de entrega. */
  async regras(brandId: string, channel: SalesChannel = SalesChannel.DELIVERY) {
    await this.findOne(brandId); // garante que a marca é deste tenant
    return {
      horarios: await this.operacao.horariosDaSemana(brandId, channel),
      areas: await this.operacao.areasDeEntrega(brandId, channel),
    };
  }

  create(data: { name: string; slug: string; primaryColor?: string }) {
    return this.tenantPrisma.db.brand.create({ data: data as any });
  }
}
