import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PortalService } from './portal.service';
import { BillingService } from './billing.service';
import { LimitesService } from './limites.service';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequestContext } from '../../common/tenant/tenant-context.service';
import { Public } from '../../common/auth/public.decorator';

/** Entrar no portal e assinar plano é decisão do dono. */
const GESTAO = [Role.OWNER, Role.MANAGER];

/**
 * O lado do RESTAURANTE: entrar/sair do portal e cuidar da assinatura.
 */
@Controller('portal-admin')
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly billing: BillingService,
    private readonly limites: LimitesService,
  ) {}

  // ------------------------------------------------ opt-in no portal ------

  @Get('listagem/:brandId')
  @Roles(...GESTAO)
  minhaListagem(@Param('brandId') brandId: string) {
    return this.portal.minhaListagem(brandId);
  }

  /** Ligar ou desligar a marca na vitrine. */
  @Patch('listagem/:brandId')
  @Roles(...GESTAO)
  definirListagem(
    @Param('brandId') brandId: string,
    @Body()
    dto: {
      active: boolean;
      category?: string;
      headline?: string;
      commissionBps?: number;
      city?: string;
    },
  ) {
    return this.portal.definirListagem(brandId, dto);
  }

  // ---------------------------------------------------- assinatura --------

  @Get('planos')
  @Roles(...GESTAO)
  planos() {
    return this.billing.listarPlanos();
  }

  @Get('assinatura')
  @Roles(...GESTAO)
  assinatura(@CurrentUser() user: RequestContext) {
    return this.billing.minhaAssinatura(user.tenantId);
  }

  /**
   * Quanto do plano já foi usado e se a conta está em dia.
   *
   * Sem @Roles de propósito: é o que alimenta a faixa de aviso do Painel, e
   * o gerente também precisa ver que o limite está perto de estourar.
   */
  @Get('consumo')
  consumo(@CurrentUser() user: RequestContext) {
    return this.limites.consumo(user.tenantId);
  }

  @Post('assinatura')
  @Roles(Role.OWNER)
  assinar(@CurrentUser() user: RequestContext, @Body() dto: { planCode: string }) {
    return this.billing.assinar(user.tenantId, dto.planCode);
  }

  @Post('assinatura/cancelar')
  @Roles(Role.OWNER)
  cancelar(@CurrentUser() user: RequestContext) {
    return this.billing.cancelar(user.tenantId);
  }

  /** Emite a fatura agora — em produção quem faz isso é a tarefa mensal. */
  @Post('assinatura/faturar')
  @Roles(Role.OWNER)
  faturar(@CurrentUser() user: RequestContext) {
    return this.billing.emitirFatura(user.tenantId);
  }

  /** Aviso do cobrador: a fatura foi paga. */
  @Public()
  @Post('cobranca/webhook')
  webhook(@Body() payload: { invoiceExternalId: string; status: string }) {
    return this.billing.processarWebhook(payload);
  }
}
