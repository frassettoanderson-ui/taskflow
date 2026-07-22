import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { CashbackCodeService } from './cashback-code.service';
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
    private readonly codigos: CashbackCodeService,
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

  /**
   * "Me manda o código para eu usar meu cashback."
   *
   * Responde igual para telefone com e sem cadastro — de propósito: senão a
   * tela vira uma forma de descobrir quem é cliente da casa.
   */
  @Public()
  @Post('cashback/:brandSlug/codigo')
  pedirCodigo(@Param('brandSlug') brandSlug: string, @Body() dto: { telefone: string }) {
    return this.codigos.pedir(brandSlug, dto?.telefone ?? '');
  }

  /** "Aqui está o código." Devolve a senha temporária do resgate. */
  @Public()
  @Post('cashback/:brandSlug/confirmar')
  confirmarCodigo(
    @Param('brandSlug') brandSlug: string,
    @Body() dto: { telefone: string; codigo: string },
  ) {
    return this.codigos.confirmar(brandSlug, dto?.telefone ?? '', dto?.codigo ?? '');
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
