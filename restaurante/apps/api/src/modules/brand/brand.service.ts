import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';

/**
 * Marcas do tenant logado.
 *
 * Repare que NENHUM método aqui escreve "tenantId" — quem cuida disso é o
 * TenantPrismaService. É esse o desenho: o programador não pode esquecer,
 * porque não é ele quem faz.
 */
@Injectable()
export class BrandService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  list() {
    return this.tenantPrisma.db.brand.findMany({
      orderBy: { name: 'asc' },
    });
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

  create(data: { name: string; slug: string; primaryColor?: string }) {
    return this.tenantPrisma.db.brand.create({ data: data as any });
  }
}
