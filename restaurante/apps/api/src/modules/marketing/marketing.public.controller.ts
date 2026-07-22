import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { CouponService } from './coupon.service';
import { RetentionService } from './retention.service';
import { Public } from '../../common/auth/public.decorator';

/**
 * O que o CLIENTE usa — tudo sem login:
 * consultar cashback, testar cupom, salvar carrinho e responder a pesquisa.
 */
@Controller('public')
export class MarketingPublicController {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly cupons: CouponService,
    private readonly retencao: RetentionService,
  ) {}

  /** "Quanto eu tenho de cashback aqui?" */
  @Public()
  @Get('cashback/:brandSlug')
  cashback(
    @Param('brandSlug') brandSlug: string,
    @Query('telefone') telefone: string,
    @Query('subtotal') subtotal?: string,
  ) {
    return this.loyalty.consultarPorTelefone(brandSlug, telefone ?? '', Number(subtotal ?? 0));
  }

  /** "Este cupom vale para mim?" */
  @Public()
  @Post('cupom/:brandSlug')
  testarCupom(
    @Param('brandSlug') brandSlug: string,
    @Body()
    dto: { code: string; subtotalCents: number; deliveryFeeCents?: number; telefone?: string },
  ) {
    return this.cupons.simularParaCliente({
      brandSlug,
      code: dto.code,
      subtotalCents: dto.subtotalCents,
      deliveryFeeCents: dto.deliveryFeeCents ?? 0,
      telefone: dto.telefone,
    });
  }

  /** O cardápio avisa aqui quando o carrinho muda (para a recuperação). */
  @Public()
  @Post('carrinho/:brandSlug')
  salvarCarrinho(
    @Param('brandSlug') brandSlug: string,
    @Body()
    dto: {
      clientKey: string;
      itens: unknown;
      subtotalCents: number;
      nome?: string;
      telefone?: string;
    },
  ) {
    return this.retencao.salvarCarrinho({ brandSlug, ...dto });
  }

  /** A pesquisa de satisfação, pelo link que o cliente recebe. */
  @Public()
  @Get('avaliar/:token')
  verPesquisa(@Param('token') token: string) {
    return this.retencao.pesquisaPorToken(token);
  }

  @Public()
  @Post('avaliar/:token')
  responderPesquisa(@Param('token') token: string, @Body() dto: { nota: number; comentario?: string }) {
    return this.retencao.responderPesquisa(token, dto.nota, dto.comentario);
  }
}
