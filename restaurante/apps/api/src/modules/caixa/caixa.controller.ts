import { Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CaixaService } from './caixa.service';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequestContext } from '../../common/tenant/tenant-context.service';

/** Abrir/fechar caixa é do dono, gerente e caixa. */
const CAIXA = [Role.OWNER, Role.MANAGER, Role.CASHIER];

@Controller('caixa')
export class CaixaController {
  constructor(private readonly caixa: CaixaService) {}

  /** O caixa está aberto? Desde quando? Quantos pedidos já saíram? */
  @Roles(...CAIXA)
  @Get()
  estado() {
    return this.caixa.estado();
  }

  /** Abre o caixa — começa um novo dia e zera a numeração. */
  @Roles(...CAIXA)
  @Post('abrir')
  abrir(@CurrentUser() usuario: RequestContext) {
    return this.caixa.abrir(usuario.userId);
  }

  /** Fecha o caixa — encerra o dia. */
  @Roles(...CAIXA)
  @Post('fechar')
  fechar(@CurrentUser() usuario: RequestContext) {
    return this.caixa.fechar(usuario.userId);
  }
}
