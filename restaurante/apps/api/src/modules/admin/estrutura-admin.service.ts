import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { paraSlug } from './catalog-admin.service';

/**
 * A ESTRUTURA FÍSICA: unidades (lojas), estações de produção e mesas do salão.
 * Até aqui tudo vinha do seed; agora o restaurante monta a própria operação.
 */
@Injectable()
export class EstruturaAdminService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // =========================================================================
  //  UNIDADES (lojas)
  // =========================================================================

  async listarUnidades() {
    const unidades = await this.tenantPrisma.db.unit.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { stations: true, tables: true, brands: true } },
        brands: { include: { brand: { select: { id: true, name: true } } } },
      },
    });

    return unidades.map((u) => ({
      id: u.id,
      nome: u.name,
      cnpj: u.cnpj,
      endereco: {
        rua: u.addressStreet,
        numero: u.addressNumber,
        bairro: u.addressDistrict,
        cidade: u.addressCity,
      },
      latitude: u.latitude,
      longitude: u.longitude,
      taxaDeServicoPercentual: u.serviceFeeBps / 100,
      ativa: u.active,
      estacoes: u._count.stations,
      mesas: u._count.tables,
      marcas: u.brands.map((b) => b.brand),
    }));
  }

  criarUnidade(dados: {
    name: string;
    cnpj?: string;
    addressStreet?: string;
    addressNumber?: string;
    addressDistrict?: string;
    addressCity?: string;
    latitude?: number;
    longitude?: number;
    serviceFeeBps?: number;
  }) {
    return this.tenantPrisma.db.unit.create({ data: { ...dados, name: dados.name.trim() } as any });
  }

  atualizarUnidade(id: string, dados: Record<string, unknown>) {
    return this.tenantPrisma.db.unit.update({ where: { id }, data: dados as any });
  }

  /** Liga uma marca a uma unidade (é o que permite a dark kitchen). */
  async vincularMarca(unitId: string, brandId: string, ativo = true) {
    return this.tenantPrisma.db.brandUnit.upsert({
      where: { brandId_unitId: { brandId, unitId } },
      update: { active: ativo },
      create: { brandId, unitId, active: ativo } as any,
    });
  }

  // =========================================================================
  //  ESTAÇÕES DE PRODUÇÃO
  // =========================================================================

  async listarEstacoes(unitId?: string) {
    const estacoes = await this.tenantPrisma.db.station.findMany({
      where: unitId ? { unitId } : {},
      orderBy: [{ unitId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        unit: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });

    return estacoes.map((e) => ({
      id: e.id,
      nome: e.name,
      unidade: e.unit.name,
      unitId: e.unitId,
      ordem: e.sortOrder,
      ativa: e.active,
      itensLigados: e._count.items,
    }));
  }

  async criarEstacao(unitId: string, name: string) {
    const ultima = await this.tenantPrisma.db.station.findFirst({
      where: { unitId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.tenantPrisma.db.station.create({
      data: { unitId, name: name.trim(), sortOrder: (ultima?.sortOrder ?? -1) + 1 } as any,
    });
  }

  atualizarEstacao(id: string, dados: Partial<{ name: string; active: boolean }>) {
    return this.tenantPrisma.db.station.update({ where: { id }, data: dados });
  }

  /** Apagar estação não apaga item: eles só ficam sem estação. */
  async apagarEstacao(id: string) {
    const itens = await this.tenantPrisma.db.item.count({ where: { stationId: id } });
    await this.tenantPrisma.db.station.delete({ where: { id } });
    return { apagada: true, itensDesvinculados: itens };
  }

  // =========================================================================
  //  MESAS
  // =========================================================================

  async listarMesas(unitId?: string) {
    const mesas = await this.tenantPrisma.db.table.findMany({
      where: unitId ? { unitId } : {},
      orderBy: [{ area: 'asc' }, { posY: 'asc' }, { posX: 'asc' }],
      include: { brand: { select: { id: true, name: true } }, unit: { select: { name: true } } },
    });

    return mesas.map((m) => ({
      id: m.id,
      numero: m.number,
      area: m.area,
      lugares: m.seats,
      posX: m.posX,
      posY: m.posY,
      qrToken: m.qrToken,
      /** o endereço que vai dentro do QR Code */
      enderecoDoQr: `/mesa/${m.qrToken}`,
      status: m.status,
      ativa: m.active,
      marca: m.brand,
      unidade: m.unit.name,
    }));
  }

  async criarMesa(dados: {
    unitId: string;
    brandId: string;
    number: string;
    area?: string;
    seats?: number;
  }) {
    const numero = dados.number.trim();
    if (!numero) throw new BadRequestException('Informe o número da mesa.');

    const existe = await this.tenantPrisma.db.table.findFirst({
      where: { unitId: dados.unitId, number: numero },
    });
    if (existe) throw new BadRequestException(`Já existe a mesa "${numero}" nesta unidade.`);

    // Posição: entra no fim da fila da área.
    const naArea = await this.tenantPrisma.db.table.count({
      where: { unitId: dados.unitId, area: dados.area ?? 'Salão' },
    });

    // O código do QR precisa ser único no sistema inteiro.
    let token = `mesa-${paraSlug(numero)}`;
    let n = 1;
    while (await this.tenantPrisma.db.table.findFirst({ where: { qrToken: token } })) {
      token = `mesa-${paraSlug(numero)}-${n++}`;
    }

    return this.tenantPrisma.db.table.create({
      data: {
        unitId: dados.unitId,
        brandId: dados.brandId,
        number: numero,
        area: dados.area ?? 'Salão',
        seats: dados.seats ?? 4,
        posX: naArea % 4,
        posY: Math.floor(naArea / 4),
        qrToken: token,
      } as any,
    });
  }

  /** Cria várias mesas de uma vez — ninguém quer cadastrar 20 uma a uma. */
  async criarMesasEmLote(dados: {
    unitId: string;
    brandId: string;
    de: number;
    ate: number;
    area?: string;
    seats?: number;
  }) {
    if (dados.ate < dados.de) throw new BadRequestException('O número final é menor que o inicial.');
    if (dados.ate - dados.de > 99) throw new BadRequestException('No máximo 100 mesas por vez.');

    const criadas: string[] = [];
    const puladas: string[] = [];

    for (let n = dados.de; n <= dados.ate; n++) {
      try {
        await this.criarMesa({
          unitId: dados.unitId,
          brandId: dados.brandId,
          number: String(n),
          area: dados.area,
          seats: dados.seats,
        });
        criadas.push(String(n));
      } catch {
        puladas.push(String(n)); // já existia
      }
    }

    return { criadas: criadas.length, puladas: puladas.length, numeros: criadas };
  }

  atualizarMesa(
    id: string,
    dados: Partial<{ number: string; area: string; seats: number; active: boolean; posX: number; posY: number }>,
  ) {
    return this.tenantPrisma.db.table.update({ where: { id }, data: dados });
  }

  async apagarMesa(id: string) {
    const comandas = await this.tenantPrisma.db.tableSession.count({
      where: { tableId: id, status: { in: ['OPEN', 'CLOSING'] } },
    });
    if (comandas > 0) {
      throw new BadRequestException('Esta mesa tem comanda aberta. Feche a conta antes de apagar.');
    }
    await this.tenantPrisma.db.table.delete({ where: { id } });
    return { apagada: true };
  }
}
