import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';

/**
 * O CAIXA do dia.
 *
 * Abrir o caixa começa um novo dia — e é isso que zera a numeração dos pedidos.
 * Cada pedido, de qualquer canal e de qualquer marca, leva o próximo número da
 * sessão aberta (1, 2, 3...). Fechar o caixa encerra o dia; a próxima abertura
 * recomeça do 1.
 *
 * Só existe UMA sessão aberta por vez (closedAt nulo) por empresa.
 */
@Injectable()
export class CaixaService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** A sessão aberta agora, ou null se o caixa está fechado. */
  private async sessaoAberta() {
    return this.tenantPrisma.db.cashSession.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: 'desc' },
    });
  }

  /** O estado do caixa, para a tela: aberto?, desde quando, quantos pedidos. */
  async estado() {
    const s = await this.sessaoAberta();
    if (!s) return { aberto: false as const };
    return {
      aberto: true as const,
      abertoEm: s.openedAt,
      pedidosNaSessao: s.orderCount,
    };
  }

  /** Abre o caixa (novo dia). Se já estiver aberto, devolve o que está. */
  async abrir(userId?: string) {
    const jaAberto = await this.sessaoAberta();
    if (jaAberto) return this.estado();

    await this.tenantPrisma.db.cashSession.create({
      data: { openedById: userId ?? null } as any,
    });
    return this.estado();
  }

  /** Fecha o caixa. Se já estiver fechado, não faz nada. */
  async fechar(userId?: string) {
    const aberto = await this.sessaoAberta();
    if (!aberto) return { aberto: false as const };

    await this.tenantPrisma.db.cashSession.update({
      where: { id: aberto.id },
      data: { closedAt: new Date(), closedById: userId ?? null },
    });
    return { aberto: false as const };
  }

  /**
   * O número do próximo pedido, ou null se o caixa está fechado.
   *
   * O incremento é atômico (a linha da sessão é travada pelo banco durante o
   * update), então dois pedidos ao mesmo tempo nunca levam o mesmo número.
   */
  async proximoNumero(): Promise<number | null> {
    const aberto = await this.sessaoAberta();
    if (!aberto) return null;

    const atualizado = await this.tenantPrisma.db.cashSession.update({
      where: { id: aberto.id },
      data: { orderCount: { increment: 1 } },
      select: { orderCount: true },
    });
    return atualizado.orderCount;
  }
}
