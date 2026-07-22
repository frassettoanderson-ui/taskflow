import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryAreaKind, SalesChannel } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** "11:30" -> 690 minutos desde a meia-noite. */
function paraMinutos(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) throw new BadRequestException(`Horário inválido: ${hhmm}`);
  return h * 60 + m;
}

function paraHora(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * As REGRAS DE OPERAÇÃO cadastráveis: horário de funcionamento e área de
 * entrega. Até aqui vinham do seed.
 */
@Injectable()
export class OperacaoAdminService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // =========================================================================
  //  HORÁRIOS
  // =========================================================================

  async horarios(brandId: string, channel: SalesChannel) {
    const linhas = await this.tenantPrisma.db.openingHour.findMany({
      where: { brandId, channel },
      orderBy: [{ weekday: 'asc' }, { opensAtMinutes: 'asc' }],
    });

    return DIAS.map((nome, dia) => {
      const doDia = linhas.filter((l) => l.weekday === dia);
      return {
        weekday: dia,
        dia: nome,
        fechado: doDia.length === 0,
        faixas: doDia.map((l) => ({
          id: l.id,
          abre: paraHora(l.opensAtMinutes),
          fecha: paraHora(l.closesAtMinutes),
        })),
      };
    });
  }

  /**
   * Grava a semana inteira de uma vez.
   *
   * Apagamos e regravamos de propósito: é bem mais simples de entender do que
   * comparar linha a linha, e a tabela é pequena.
   */
  async salvarHorarios(
    brandId: string,
    channel: SalesChannel,
    semana: Array<{ weekday: number; faixas: Array<{ abre: string; fecha: string }> }>,
  ) {
    for (const dia of semana) {
      for (const f of dia.faixas) {
        const abre = paraMinutos(f.abre);
        const fecha = paraMinutos(f.fecha);
        if (fecha <= abre) {
          throw new BadRequestException(
            `Em ${DIAS[dia.weekday]}, o horário de fechar precisa ser depois do de abrir.`,
          );
        }
      }
    }

    await this.tenantPrisma.db.openingHour.deleteMany({ where: { brandId, channel } });

    for (const dia of semana) {
      for (const f of dia.faixas) {
        await this.tenantPrisma.db.openingHour.create({
          data: {
            brandId,
            channel,
            weekday: dia.weekday,
            opensAtMinutes: paraMinutos(f.abre),
            closesAtMinutes: paraMinutos(f.fecha),
          } as any,
        });
      }
    }

    return this.horarios(brandId, channel);
  }

  /** Atalho: mesmo horário todos os dias. */
  salvarHorarioIgualTodoDia(brandId: string, channel: SalesChannel, abre: string, fecha: string) {
    return this.salvarHorarios(
      brandId,
      channel,
      DIAS.map((_, weekday) => ({ weekday, faixas: [{ abre, fecha }] })),
    );
  }

  // =========================================================================
  //  ÁREAS DE ENTREGA
  // =========================================================================

  async areas(brandId: string) {
    const linhas = await this.tenantPrisma.db.deliveryArea.findMany({
      where: { brandId },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
    });

    return linhas.map((a) => ({
      id: a.id,
      tipo: a.kind,
      bairro: a.districtName,
      ateKm: a.maxDistanceKm,
      freteCents: a.feeCents,
      pedidoMinimoCents: a.minOrderCents,
      ativa: a.active,
    }));
  }

  async criarArea(dados: {
    brandId: string;
    kind: DeliveryAreaKind;
    districtName?: string;
    maxDistanceKm?: number;
    feeCents: number;
    minOrderCents?: number;
  }) {
    if (dados.kind === DeliveryAreaKind.DISTRICT && !dados.districtName?.trim()) {
      throw new BadRequestException('Informe o nome do bairro.');
    }
    if (dados.kind === DeliveryAreaKind.RADIUS && !dados.maxDistanceKm) {
      throw new BadRequestException('Informe até quantos km esta faixa vale.');
    }
    if (dados.feeCents < 0) throw new BadRequestException('O frete não pode ser negativo.');

    const ultima = await this.tenantPrisma.db.deliveryArea.findFirst({
      where: { brandId: dados.brandId, kind: dados.kind },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.tenantPrisma.db.deliveryArea.create({
      data: {
        brandId: dados.brandId,
        channel: SalesChannel.DELIVERY,
        kind: dados.kind,
        districtName: dados.districtName?.trim(),
        maxDistanceKm: dados.maxDistanceKm,
        feeCents: dados.feeCents,
        minOrderCents: dados.minOrderCents ?? 0,
        sortOrder: (ultima?.sortOrder ?? -1) + 1,
      } as any,
    });
  }

  atualizarArea(
    id: string,
    dados: Partial<{ feeCents: number; minOrderCents: number; active: boolean; districtName: string; maxDistanceKm: number }>,
  ) {
    return this.tenantPrisma.db.deliveryArea.update({ where: { id }, data: dados });
  }

  async apagarArea(id: string) {
    await this.tenantPrisma.db.deliveryArea.delete({ where: { id } });
    return { apagada: true };
  }

  // =========================================================================
  //  PROGRAMA DE CASHBACK
  // =========================================================================

  async cashback(brandId: string) {
    const p = await this.tenantPrisma.db.loyaltyProgram.findUnique({ where: { brandId } });
    if (!p) {
      return {
        existe: false,
        ativo: false,
        percentual: 5,
        pedidoMinimoCents: 0,
        validadeDias: 90,
        maxResgatePercentual: 50,
      };
    }
    return {
      existe: true,
      ativo: p.active,
      percentual: p.cashbackBps / 100,
      pedidoMinimoCents: p.minOrderCents,
      validadeDias: p.expiresInDays,
      maxResgatePercentual: p.maxRedeemBps / 100,
    };
  }

  async salvarCashback(
    brandId: string,
    dados: {
      active: boolean;
      percentual: number;
      pedidoMinimoCents: number;
      validadeDias: number;
      maxResgatePercentual: number;
    },
  ) {
    if (dados.percentual < 0 || dados.percentual > 50) {
      throw new BadRequestException('O cashback precisa estar entre 0% e 50%.');
    }

    const valores = {
      active: dados.active,
      cashbackBps: Math.round(dados.percentual * 100),
      minOrderCents: dados.pedidoMinimoCents,
      expiresInDays: dados.validadeDias,
      maxRedeemBps: Math.round(dados.maxResgatePercentual * 100),
    };

    await this.tenantPrisma.db.loyaltyProgram.upsert({
      where: { brandId },
      update: valores,
      create: { brandId, ...valores } as any,
    });

    return this.cashback(brandId);
  }
}
