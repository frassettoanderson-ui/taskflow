import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponType, CustomerSegment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { limparTelefone } from './loyalty.service';

export interface DescontoDoCupom {
  couponId: string;
  code: string;
  description: string | null;
  /** desconto sobre os itens, em centavos */
  discountCents: number;
  /** o frete fica de graça? */
  freteGratis: boolean;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

@Injectable()
export class CouponService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
  ) {}

  // =========================================================================
  //  Validação — o coração do cupom
  // =========================================================================

  /**
   * Confere se o cupom vale para ESTE cliente, NESTE momento, NESTE pedido.
   *
   * Toda a conferência é feita AQUI, no servidor. A tela só mostra o resultado —
   * ninguém aplica desconto pelo navegador.
   */
  async validar(entrada: {
    brandId: string;
    code: string;
    subtotalCents: number;
    deliveryFeeCents: number;
    /** cliente já existente nesta marca (pode não existir ainda) */
    customerId?: string | null;
    telefone?: string;
    agora?: Date;
  }): Promise<DescontoDoCupom> {
    const agora = entrada.agora ?? new Date();
    const codigo = entrada.code.trim().toUpperCase();

    const cupom = await this.tenantPrisma.db.coupon.findFirst({
      where: { brandId: entrada.brandId, code: codigo },
    });

    if (!cupom || !cupom.active) {
      throw new BadRequestException(`O cupom "${codigo}" não existe ou não está mais valendo.`);
    }

    // ---- validade ----
    if (cupom.validFrom && agora < cupom.validFrom) {
      throw new BadRequestException('Este cupom ainda não começou a valer.');
    }
    if (cupom.validUntil && agora > cupom.validUntil) {
      throw new BadRequestException('Este cupom já venceu.');
    }

    // ---- dia da semana ----
    if (cupom.weekdays.length > 0 && !cupom.weekdays.includes(agora.getDay())) {
      const nomes = cupom.weekdays.map((d) => DIAS[d]).join(', ');
      throw new BadRequestException(`Este cupom só vale ${nomes}.`);
    }

    // ---- faixa de horário ----
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    if (cupom.hourFromMinutes != null && cupom.hourToMinutes != null) {
      if (minutosAgora < cupom.hourFromMinutes || minutosAgora > cupom.hourToMinutes) {
        throw new BadRequestException(
          `Este cupom só vale das ${hhmm(cupom.hourFromMinutes)} às ${hhmm(cupom.hourToMinutes)}.`,
        );
      }
    }

    // ---- valor mínimo ----
    if (entrada.subtotalCents < cupom.minOrderCents) {
      throw new BadRequestException(
        `Este cupom vale a partir de ${(cupom.minOrderCents / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}.`,
      );
    }

    // ---- limite geral de uso ----
    if (cupom.usageLimit > 0 && cupom.usedCount >= cupom.usageLimit) {
      throw new BadRequestException('Este cupom já esgotou.');
    }

    // ---- o cliente se encaixa no segmento? ----
    await this.conferirSegmento(cupom, entrada.brandId, entrada.customerId, entrada.telefone, agora);

    // ---- quantas vezes ESTE cliente já usou ----
    if (entrada.customerId && cupom.usageLimitPerCustomer > 0) {
      const usos = await this.tenantPrisma.db.couponRedemption.count({
        where: { couponId: cupom.id, customerId: entrada.customerId },
      });
      if (usos >= cupom.usageLimitPerCustomer) {
        throw new BadRequestException('Você já usou este cupom.');
      }
    }

    // ---- calcular o desconto ----
    let discountCents = 0;
    let freteGratis = false;

    if (cupom.type === CouponType.PERCENT) {
      discountCents = Math.round((entrada.subtotalCents * cupom.value) / 10000);
      if (cupom.maxDiscountCents > 0) {
        discountCents = Math.min(discountCents, cupom.maxDiscountCents);
      }
    } else if (cupom.type === CouponType.FIXED) {
      discountCents = cupom.value;
    } else {
      freteGratis = true;
      discountCents = 0;
    }

    // O desconto nunca pode passar do valor dos itens.
    discountCents = Math.min(discountCents, entrada.subtotalCents);

    return {
      couponId: cupom.id,
      code: cupom.code,
      description: cupom.description,
      discountCents,
      freteGratis,
    };
  }

  /** Regras de "para quem" o cupom vale. */
  private async conferirSegmento(
    cupom: { segment: CustomerSegment; inactiveDays: number },
    brandId: string,
    customerId?: string | null,
    telefone?: string,
    agora = new Date(),
  ) {
    if (cupom.segment === CustomerSegment.ALL) return;

    // Sem cliente conhecido: só passa no "primeiro pedido".
    if (!customerId) {
      if (cupom.segment === CustomerSegment.FIRST_ORDER) return;
      throw new BadRequestException('Este cupom é para clientes que já pediram aqui.');
    }

    const cliente = await this.tenantPrisma.db.tenantCustomer.findUnique({
      where: { id: customerId },
      select: { ordersCount: true, lastOrderAt: true },
    });
    if (!cliente) return;

    if (cupom.segment === CustomerSegment.FIRST_ORDER) {
      if (cliente.ordersCount > 0) {
        throw new BadRequestException('Este cupom é só para o primeiro pedido.');
      }
      return;
    }

    if (cupom.segment === CustomerSegment.RECURRING) {
      if (cliente.ordersCount < 3) {
        throw new BadRequestException('Este cupom é para clientes frequentes (3 pedidos ou mais).');
      }
      return;
    }

    if (cupom.segment === CustomerSegment.NEW) {
      if (cliente.ordersCount > 1) {
        throw new BadRequestException('Este cupom é só para clientes novos.');
      }
      return;
    }

    if (cupom.segment === CustomerSegment.INACTIVE) {
      const limite = new Date(agora);
      limite.setDate(limite.getDate() - cupom.inactiveDays);

      if (cliente.lastOrderAt && cliente.lastOrderAt > limite) {
        throw new BadRequestException(
          `Este cupom é para quem não pede há mais de ${cupom.inactiveDays} dias.`,
        );
      }
    }
  }

  /** Registra o uso depois que o pedido foi criado. */
  async registrarUso(
    couponId: string,
    customerId: string,
    orderId: string,
    discountCents: number,
  ) {
    await this.tenantPrisma.db.couponRedemption.create({
      data: { couponId, customerId, orderId, discountCents } as any,
    });
    await this.tenantPrisma.db.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  /**
   * Simulação para a tela do cliente: "este cupom vale para mim?".
   * Devolve a mensagem de erro em vez de estourar, para a tela mostrar bonito.
   */
  async simularParaCliente(entrada: {
    brandSlug: string;
    code: string;
    subtotalCents: number;
    deliveryFeeCents: number;
    telefone?: string;
  }) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: entrada.brandSlug },
      select: { id: true, tenantId: true },
    });
    if (!brand) throw new NotFoundException('Restaurante não encontrado.');

    return this.context.runAsTenant(brand.tenantId, async () => {
      const phone = limparTelefone(entrada.telefone ?? '');
      const cliente = phone
        ? await this.tenantPrisma.db.tenantCustomer.findFirst({
            where: { brandId: brand.id, phone },
            select: { id: true },
          })
        : null;

      try {
        const r = await this.validar({
          brandId: brand.id,
          code: entrada.code,
          subtotalCents: entrada.subtotalCents,
          deliveryFeeCents: entrada.deliveryFeeCents,
          customerId: cliente?.id,
          telefone: phone,
        });
        return { valido: true as const, ...r };
      } catch (e: any) {
        return { valido: false as const, motivo: e?.message ?? 'Cupom inválido.' };
      }
    });
  }

  // =========================================================================
  //  Administração
  // =========================================================================

  listar(brandId?: string) {
    return this.tenantPrisma.db.coupon.findMany({
      where: brandId ? { brandId } : {},
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
  }

  async criar(dados: {
    brandId: string;
    code: string;
    description?: string;
    type: CouponType;
    value: number;
    maxDiscountCents?: number;
    minOrderCents?: number;
    segment?: CustomerSegment;
    inactiveDays?: number;
    weekdays?: number[];
    hourFromMinutes?: number;
    hourToMinutes?: number;
    validUntil?: string;
    usageLimit?: number;
    usageLimitPerCustomer?: number;
  }) {
    const code = dados.code.trim().toUpperCase();

    const existe = await this.tenantPrisma.db.coupon.findFirst({
      where: { brandId: dados.brandId, code },
    });
    if (existe) throw new BadRequestException(`Já existe um cupom "${code}" nesta marca.`);

    return this.tenantPrisma.db.coupon.create({
      data: {
        ...dados,
        code,
        validUntil: dados.validUntil ? new Date(dados.validUntil) : null,
      } as any,
    });
  }

  async ligarDesligar(id: string, ativo: boolean) {
    return this.tenantPrisma.db.coupon.update({
      where: { id },
      data: { active: ativo },
      select: { id: true, code: true, active: true },
    });
  }
}
