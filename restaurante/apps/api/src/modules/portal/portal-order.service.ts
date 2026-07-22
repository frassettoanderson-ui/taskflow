import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { OrderService } from '../order/order.service';
import { CreateOrderDto } from '../order/dto/create-order.dto';
import { lerRegras } from '../order/pricing';
import { NetworkWalletService } from './network-wallet.service';
import { GraduationService } from './graduation.service';
import { CashbackCodeService } from '../marketing/cashback-code.service';

/**
 * Orquestra o pedido feito pela VITRINE.
 *
 * A sequência importa:
 *   1) cria o pedido no tenant dono da marca (ele vê como qualquer pedido);
 *   2) liga o cliente à identidade da rede (sem misturar as bases);
 *   3) credita a carteira da rede;
 *   4) gera o incentivo de graduação.
 *
 * Os passos 2 a 4 são "extras": se algum falhar, o pedido continua valendo.
 */
@Injectable()
export class PortalOrderService {
  private readonly logger = new Logger(PortalOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly orders: OrderService,
    private readonly carteira: NetworkWalletService,
    private readonly graduacao: GraduationService,
    private readonly codigos: CashbackCodeService,
  ) {}

  async criarPedido(brandSlug: string, dto: CreateOrderDto) {
    const listagem = await this.prisma.portalListing.findFirst({
      where: { active: true, brand: { slug: brandSlug } },
      select: {
        id: true,
        tenantId: true,
        commissionBps: true,
        brand: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!listagem) throw new NotFoundException('Este restaurante não está no portal.');

    const comissaoBps = listagem.commissionBps ?? lerRegras().comissaoPortalBps;

    // 0) Vai usar a carteira da rede? Então prove que o telefone é seu.
    //    A carteira tem o mesmo risco do cashback da marca: o telefone
    //    identifica, não prova. Reaproveitamos o MESMO código de 6 dígitos.
    let usarDaCarteiraCents = 0;
    if (dto.useNetworkWalletCents && dto.useNetworkWalletCents > 0) {
      // O token vive dentro do tenant dono da marca, e o portal roda fora de
      // qualquer tenant. Entramos no contexto dele só para esta conferência —
      // a camada de isolamento recusa a consulta se não fizermos isso, e é
      // exatamente assim que ela deve se comportar.
      await this.context.runAsTenant(listagem.tenantId, () =>
        this.codigos.consumirToken(listagem.brand.id, dto.customerPhone, dto.cashbackToken),
      );
      usarDaCarteiraCents = await this.carteira.quantoPodeUsar(
        dto.customerPhone,
        dto.useNetworkWalletCents,
      );
    }

    // 1) O pedido nasce dentro do tenant, como qualquer outro.
    const r = await this.orders.criarPedidoDoPortal(
      brandSlug,
      dto,
      comissaoBps,
      usarDaCarteiraCents,
    );

    // 1.1) Baixa na carteira só DEPOIS de o pedido existir: se a criação
    //      falhasse, o cliente teria perdido saldo sem receber nada.
    if (usarDaCarteiraCents > 0) {
      try {
        await this.carteira.resgatar(
          dto.customerPhone,
          usarDaCarteiraCents,
          r.pedido.code,
          listagem.brand.name,
        );
      } catch (e) {
        this.logger.error(`Não consegui baixar a carteira do pedido ${r.pedido.code}: ${e}`);
      }
    }

    // Conta quantos pedidos o portal já trouxe (o argumento de venda da vitrine).
    await this.prisma.portalListing.update({
      where: { id: listagem.id },
      data: { ordersFromPortal: { increment: 1 } },
    });

    // 2) Identidade na rede — sem juntar as bases das marcas.
    try {
      await this.carteira.vincularClienteDaMarca(r.clienteId, dto.customerPhone, dto.customerName);
    } catch (e) {
      this.logger.error(`Não consegui vincular o cliente à rede: ${e}`);
    }

    // 3) Cashback da rede.
    let cashbackDaRede = 0;
    try {
      const c = await this.carteira.creditarPorPedidoDoPortal({
        telefone: dto.customerPhone,
        nome: dto.customerName,
        orderCode: r.pedido.code,
        brandName: listagem.brand.name,
        subtotalCents: r.pedido.subtotalCents,
      });
      cashbackDaRede = c.creditado;
    } catch (e) {
      this.logger.error(`Não consegui creditar a carteira da rede: ${e}`);
    }

    // 4) O funil de graduação.
    let incentivo: any = null;
    try {
      incentivo = await this.graduacao.gerarIncentivo({
        tenantId: r.tenantId,
        brandId: r.brandId,
        brandName: listagem.brand.name,
        brandSlug: listagem.brand.slug,
        orderId: r.pedido.id,
        orderCode: r.pedido.code,
        customerId: r.clienteId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        economiaCents: r.portalMarkupCents,
      });
    } catch (e) {
      this.logger.error(`Não consegui gerar o incentivo de graduação: ${e}`);
    }

    return {
      code: r.pedido.code,
      totalCents: r.pedido.totalCents,
      subtotalCents: r.pedido.subtotalCents,
      deliveryFeeCents: r.pedido.deliveryFeeCents,
      marca: listagem.brand.name,
      /** quanto do preço foi comissão do portal */
      comissaoEmbutidaCents: r.portalMarkupCents,
      /** quanto custaria pedindo direto */
      totalNoCanalDiretoCents: r.subtotalDiretoCents + r.pedido.deliveryFeeCents,
      /** quanto saiu da carteira da rede neste pedido */
      usadoDaCarteiraCents: usarDaCarteiraCents,
      cashbackDaRedeCents: cashbackDaRede,
      incentivo,
    };
  }

  /**
   * O acompanhamento do pedido do portal.
   *
   * Mostra a situação e, principalmente, o incentivo de graduação — é a tela
   * onde o cliente descobre que da próxima vez pode pagar menos.
   */
  async acompanhar(code: string) {
    const cru = await this.prisma.order.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, tenantId: true, source: true },
    });
    if (!cru) throw new NotFoundException('Pedido não encontrado.');

    return this.context.runAsTenant(cru.tenantId, async () => {
      const p = await this.tenantPrisma.db.order.findUnique({
        where: { id: cru.id },
        include: {
          brand: { select: { name: true, slug: true, primaryColor: true } },
          items: { include: { modifiers: true } },
          payment: true,
          split: true,
        },
      });
      if (!p) throw new NotFoundException('Pedido não encontrado.');

      return {
        code: p.code,
        status: p.status,
        marca: p.brand,
        subtotalCents: p.subtotalCents,
        deliveryFeeCents: p.deliveryFeeCents,
        totalCents: p.totalCents,
        origem: p.source,
        comissaoEmbutidaCents: p.portalMarkupCents,
        cupomDeGraduacao: p.graduationCouponCode,
        linkDireto: `/m/${p.brand.slug}`,
        itens: p.items.map((i) => ({
          nome: i.nameSnapshot,
          quantidade: i.quantity,
          totalCents: i.totalCents,
          complementos: i.modifiers.map((m) => m.nameSnapshot),
        })),
        pagamento: p.payment
          ? { status: p.payment.status, qrCode: p.payment.qrCode, amountCents: p.payment.amountCents }
          : null,
        /** a divisão do dinheiro, para você conferir no teste */
        divisao: p.split
          ? {
              restauranteCents: p.split.restaurantCents,
              plataformaCents: p.split.platformCents,
              motoboyCents: p.split.courierCents,
              comissaoDoPortalCents: p.split.portalCommissionCents,
            }
          : null,
      };
    });
  }
}
