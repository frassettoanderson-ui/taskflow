import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PdvService } from './pdv.service';
import { VendaPdvDto } from './dto/venda-pdv.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequestContext } from '../../common/tenant/tenant-context.service';

/**
 * Rotas do caixa do balcão.
 *
 * Quem opera: dono, gerente e CAIXA. O garçom fica de fora de propósito — ele
 * lança na comanda da mesa, não mexe no dinheiro (é a mesma regra que já vale
 * no salão).
 */
const CAIXA = [Role.OWNER, Role.MANAGER, Role.CASHIER];

@Controller('pdv')
export class PdvController {
  constructor(private readonly pdv: PdvService) {}

  /** Marcas que têm cardápio de balcão. */
  @Roles(...CAIXA)
  @Get('marcas')
  marcas() {
    return this.pdv.marcas();
  }

  /** O cardápio de balcão de uma marca. */
  @Roles(...CAIXA)
  @Get('cardapio/:brandId')
  cardapio(@Param('brandId') brandId: string) {
    return this.pdv.cardapio(brandId);
  }

  /** Fecha a venda: pedido + pagamento + cozinha, num passo só. */
  @Roles(...CAIXA)
  @Post('vendas')
  vender(@Body() dto: VendaPdvDto, @CurrentUser() usuario: RequestContext) {
    return this.pdv.fechar(dto, usuario.userId);
  }

  /** Fechamento de caixa: o que passou no balcão hoje. */
  @Roles(...CAIXA)
  @Get('caixa')
  caixa(@Query('brandId') brandId?: string) {
    return this.pdv.resumoDoDia(brandId);
  }
}
