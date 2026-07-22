import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalOrderService } from './portal-order.service';
import { NetworkWalletService } from './network-wallet.service';
import { CashbackCodeService } from '../marketing/cashback-code.service';
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
    private readonly codigos: CashbackCodeService,
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

  /**
   * "Me manda o código para eu gastar o saldo da carteira."
   *
   * Mesmo mecanismo do cashback da marca: o telefone identifica, o código é
   * quem prova. Sem isto, saber o número de alguém daria acesso ao saldo dela.
   */
  @Public()
  @Post('carteira/codigo')
  pedirCodigoDaCarteira(@Body() dto: { brandSlug: string; telefone: string }) {
    return this.codigos.pedir(dto?.brandSlug ?? '', dto?.telefone ?? '', 'rede');
  }

  /** "Aqui está o código." Devolve a senha temporária do resgate. */
  @Public()
  @Post('carteira/confirmar')
  confirmarCodigoDaCarteira(
    @Body() dto: { brandSlug: string; telefone: string; codigo: string },
  ) {
    return this.codigos.confirmar(dto?.brandSlug ?? '', dto?.telefone ?? '', dto?.codigo ?? '');
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
