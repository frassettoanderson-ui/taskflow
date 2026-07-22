import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NetworkWalletType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { limparTelefone } from '../marketing/loyalty.service';

/** Quanto o portal devolve em cashback da rede (pontos-base). */
const CASHBACK_DA_REDE_BPS = Number(process.env.NETWORK_CASHBACK_BPS ?? 300); // 3%
/** Validade do cashback da rede, em dias. */
const VALIDADE_DIAS = Number(process.env.NETWORK_CASHBACK_DAYS ?? 120);

/**
 * A CARTEIRA DA REDE.
 *
 * Diferença para o cashback da marca (Etapa 4):
 *   - o da marca só vale naquele restaurante e é dinheiro do restaurante;
 *   - este vale em QUALQUER marca do portal e é bancado pela plataforma.
 *
 * Ela é da REDE, não de um tenant — por isso usa o prisma cru. Nenhum
 * restaurante vê a carteira ou o histórico de rede de ninguém.
 */
@Injectable()
export class NetworkWalletService {
  private readonly logger = new Logger(NetworkWalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Acha (ou cria) o consumidor da rede pelo telefone. */
  async acharOuCriar(telefone: string, nome?: string) {
    const phone = limparTelefone(telefone);
    if (phone.length < 10) throw new BadRequestException('Telefone inválido.');

    const existente = await this.prisma.networkCustomer.findUnique({ where: { phone } });
    if (existente) {
      if (nome && !existente.name) {
        return this.prisma.networkCustomer.update({ where: { phone }, data: { name: nome } });
      }
      return existente;
    }

    return this.prisma.networkCustomer.create({ data: { phone, name: nome } });
  }

  /**
   * Liga o cliente de uma marca à sua identidade na rede.
   *
   * ⚠️ Isto NÃO faz as marcas verem a base uma da outra: cada TenantCustomer
   * continua isolado. A ligação existe só para a carteira da rede saber que é
   * a mesma pessoa.
   */
  async vincularClienteDaMarca(tenantCustomerId: string, telefone: string, nome?: string) {
    const rede = await this.acharOuCriar(telefone, nome);

    await this.prisma.tenantCustomer.update({
      where: { id: tenantCustomerId },
      data: { networkCustomerId: rede.id },
    });

    return rede;
  }

  /** Recalcula o saldo somando o extrato (a mesma ideia do cashback da marca). */
  private async recalcularSaldo(networkCustomerId: string) {
    const soma = await this.prisma.networkWalletEntry.aggregate({
      where: { networkCustomerId },
      _sum: { amountCents: true },
    });
    const saldo = Math.max(0, soma._sum.amountCents ?? 0);

    await this.prisma.networkCustomer.update({
      where: { id: networkCustomerId },
      data: { walletCents: saldo },
    });

    return saldo;
  }

  /** Quanto este telefone tem na carteira da rede. */
  async saldoPorTelefone(telefone: string) {
    const phone = limparTelefone(telefone);
    const rede = await this.prisma.networkCustomer.findUnique({ where: { phone } });

    return {
      existe: !!rede,
      nome: rede?.name ?? null,
      saldoCents: rede?.walletCents ?? 0,
      percentualDeVolta: CASHBACK_DA_REDE_BPS / 100,
      validadeDias: VALIDADE_DIAS,
    };
  }

  /**
   * Credita o cashback da rede de um pedido do portal.
   * Idempotente pelo código do pedido.
   */
  async creditarPorPedidoDoPortal(dados: {
    telefone: string;
    nome?: string;
    orderCode: string;
    brandName: string;
    subtotalCents: number;
  }) {
    const rede = await this.acharOuCriar(dados.telefone, dados.nome);

    const jaTem = await this.prisma.networkWalletEntry.findFirst({
      where: { networkCustomerId: rede.id, orderCode: dados.orderCode, type: NetworkWalletType.EARN },
    });
    if (jaTem) return { creditado: 0, motivo: 'já creditado' };

    const valor = Math.round((dados.subtotalCents * CASHBACK_DA_REDE_BPS) / 10000);
    if (valor <= 0) return { creditado: 0, motivo: 'valor zero' };

    const vence = new Date();
    vence.setDate(vence.getDate() + VALIDADE_DIAS);

    await this.prisma.networkWalletEntry.create({
      data: {
        networkCustomerId: rede.id,
        type: NetworkWalletType.EARN,
        amountCents: valor,
        orderCode: dados.orderCode,
        brandName: dados.brandName,
        description: `${CASHBACK_DA_REDE_BPS / 100}% de volta na carteira da rede`,
        expiresAt: vence,
      },
    });

    const saldo = await this.recalcularSaldo(rede.id);
    this.logger.log(
      `Carteira da rede: +${valor} centavos para ${rede.phone} (saldo ${saldo}).`,
    );

    return { creditado: valor, saldo };
  }

  /** Usa saldo da rede num pedido. */
  /**
   * Quanto deste pedido a carteira pode cobrir.
   *
   * O teto existe para a carteira ser desconto, não moeda: pedido pago 100%
   * com saldo não gera receita para ninguém e vira porta para fraude.
   */
  async quantoPodeUsar(telefone: string, pedidoCents: number) {
    const phone = limparTelefone(telefone);
    const rede = await this.prisma.networkCustomer.findUnique({ where: { phone } });
    if (!rede) return 0;
    return Math.max(0, Math.min(rede.walletCents, pedidoCents));
  }

  async resgatar(telefone: string, amountCents: number, orderCode: string, brandName: string) {
    const phone = limparTelefone(telefone);
    const rede = await this.prisma.networkCustomer.findUnique({ where: { phone } });
    if (!rede) throw new BadRequestException('Carteira não encontrada.');

    if (amountCents > rede.walletCents) {
      throw new BadRequestException('Saldo insuficiente na carteira da rede.');
    }

    await this.prisma.networkWalletEntry.create({
      data: {
        networkCustomerId: rede.id,
        type: NetworkWalletType.REDEEM,
        amountCents: -Math.abs(amountCents),
        orderCode,
        brandName,
        description: 'Usado no portal',
      },
    });

    return { saldo: await this.recalcularSaldo(rede.id) };
  }

  /** O extrato, para a tela do consumidor. */
  async extrato(telefone: string, limite = 30) {
    const phone = limparTelefone(telefone);
    const rede = await this.prisma.networkCustomer.findUnique({ where: { phone } });
    if (!rede) return { saldoCents: 0, linhas: [] };

    const linhas = await this.prisma.networkWalletEntry.findMany({
      where: { networkCustomerId: rede.id },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });

    return {
      saldoCents: rede.walletCents,
      linhas: linhas.map((l) => ({
        tipo: l.type,
        valorCents: l.amountCents,
        marca: l.brandName,
        pedido: l.orderCode,
        descricao: l.description,
        venceEm: l.expiresAt,
        quando: l.createdAt,
      })),
    };
  }
}
