import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalOrderService } from './portal-order.service';
import { NetworkWalletService } from './network-wallet.service';
import { CreateOrderDto } from '../order/dto/create-order.dto';
import { Public } from '../../common/auth/public.decorator';

/**
 * O PORTAL visto pelo consumidor — tudo sem login.
 * É a vitrine da rede: várias marcas, de vários restaurantes.
 */
@Controller('portal')
export class PortalPublicController {
  constructor(
    private readonly portal: PortalService,
    private readonly pedidos: PortalOrderService,
    private readonly carteira: NetworkWalletService,
  ) {}

  /** A vitrine. */
  @Public()
  @Get('vitrine')
  vitrine(
    @Query('busca') busca?: string,
    @Query('categoria') categoria?: string,
    @Query('bairro') bairro?: string,
    @Query('abertas') abertas?: string,
  ) {
    return this.portal.vitrine({
      busca,
      categoria,
      bairro,
      apenasAbertas: abertas === 'sim',
    });
  }

  @Public()
  @Get('categorias')
  categorias() {
    return this.portal.categorias();
  }

  /** O cardápio com os preços do portal. */
  @Public()
  @Get('marca/:slug')
  cardapio(@Param('slug') slug: string) {
    return this.portal.cardapioDoPortal(slug);
  }

  /** Fecha o pedido pela vitrine. */
  @Public()
  @Post('marca/:slug/pedido')
  pedir(@Param('slug') slug: string, @Body() dto: CreateOrderDto) {
    return this.pedidos.criarPedido(slug, dto);
  }

  /** Acompanhamento, com o incentivo de graduação. */
  @Public()
  @Get('pedido/:code')
  acompanhar(@Param('code') code: string) {
    return this.pedidos.acompanhar(code);
  }

  /** A carteira da rede do consumidor. */
  @Public()
  @Get('carteira')
  carteiraSaldo(@Query('telefone') telefone: string) {
    return this.carteira.saldoPorTelefone(telefone ?? '');
  }

  @Public()
  @Get('carteira/extrato')
  carteiraExtrato(@Query('telefone') telefone: string) {
    return this.carteira.extrato(telefone ?? '');
  }
}
