import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CouponType, CustomerSegment, MessageKind, Role } from '@prisma/client';
import { CrmService } from './crm.service';
import { LoyaltyService } from './loyalty.service';
import { CouponService } from './coupon.service';
import { CampaignService } from './campaign.service';
import { RetentionService } from './retention.service';
import { MessagingService } from './messaging.service';
import { Roles } from '../../common/auth/roles.decorator';
import { FILAS, QueueService } from '../../queue/queue.service';

/** Marketing é coisa de quem manda no negócio. */
const GESTAO = [Role.OWNER, Role.MANAGER];

@Controller('marketing')
export class MarketingController {
  constructor(
    private readonly crm: CrmService,
    private readonly loyalty: LoyaltyService,
    private readonly cupons: CouponService,
    private readonly campanhas: CampaignService,
    private readonly retencao: RetentionService,
    private readonly carteiro: MessagingService,
    private readonly fila: QueueService,
  ) {}

  // ------------------------------------------------------------------ CRM ---

  @Get('clientes')
  @Roles(...GESTAO, Role.CASHIER)
  clientes(
    @Query('marca') marca?: string,
    @Query('segmento') segmento?: string,
    @Query('dias') dias?: string,
    @Query('busca') busca?: string,
  ) {
    return this.crm.listar({
      brandId: marca || undefined,
      segmento: (segmento as CustomerSegment) || undefined,
      diasInativo: dias ? Number(dias) : undefined,
      busca,
    });
  }

  @Get('segmentos')
  @Roles(...GESTAO, Role.CASHIER)
  segmentos(@Query('marca') marca?: string, @Query('dias') dias?: string) {
    return this.crm.contarSegmentos(marca || undefined, dias ? Number(dias) : 30);
  }

  @Get('clientes/:id')
  @Roles(...GESTAO, Role.CASHIER)
  ficha(@Param('id') id: string) {
    return this.crm.ficha(id);
  }

  @Patch('clientes/:id/opt-out')
  @Roles(...GESTAO)
  optOut(@Param('id') id: string, @Body() dto: { optOut: boolean }) {
    return this.crm.alternarOptOut(id, dto.optOut);
  }

  /** Crédito de cortesia. */
  @Post('clientes/:id/cashback')
  @Roles(...GESTAO)
  ajustarCashback(@Param('id') id: string, @Body() dto: { amountCents: number; motivo: string }) {
    return this.loyalty.ajustar(id, dto.amountCents, dto.motivo);
  }

  // -------------------------------------------------------------- cupons ---

  @Get('cupons')
  @Roles(...GESTAO)
  listarCupons(@Query('marca') marca?: string) {
    return this.cupons.listar(marca || undefined);
  }

  @Post('cupons')
  @Roles(...GESTAO)
  criarCupom(
    @Body()
    dto: {
      brandId: string;
      code: string;
      description?: string;
      type: CouponType;
      value: number;
      maxDiscountCents?: number;
      minOrderCents?: number;
      segment?: CustomerSegment;
      inactiveDays?: number;
      weekdays?: number[];
      usageLimit?: number;
      usageLimitPerCustomer?: number;
      validUntil?: string;
    },
  ) {
    return this.cupons.criar(dto);
  }

  @Patch('cupons/:id')
  @Roles(...GESTAO)
  ligarCupom(@Param('id') id: string, @Body() dto: { active: boolean }) {
    return this.cupons.ligarDesligar(id, dto.active);
  }

  // ----------------------------------------------------------- campanhas ---

  @Get('campanhas')
  @Roles(...GESTAO)
  listarCampanhas() {
    return this.campanhas.listar();
  }

  @Post('campanhas')
  @Roles(...GESTAO)
  criarCampanha(
    @Body()
    dto: {
      brandId: string;
      name: string;
      message: string;
      segment?: CustomerSegment;
      inactiveDays?: number;
    },
  ) {
    return this.campanhas.criar(dto);
  }

  @Get('campanhas/:id')
  @Roles(...GESTAO)
  resultadoCampanha(@Param('id') id: string) {
    return this.campanhas.resultado(id);
  }

  /** DISPARAR — a campanha vai para a fila. */
  @Post('campanhas/:id/disparar')
  @Roles(...GESTAO)
  dispararCampanha(@Param('id') id: string) {
    return this.campanhas.disparar(id);
  }

  // ------------------------------------------------- mensagens e retenção ---

  @Get('mensagens')
  @Roles(...GESTAO, Role.CASHIER)
  mensagens(@Query('tipo') tipo?: string, @Query('limite') limite?: string) {
    return this.carteiro.listar(limite ? Number(limite) : 100, (tipo as MessageKind) || undefined);
  }

  @Get('carrinhos')
  @Roles(...GESTAO)
  carrinhos() {
    return this.retencao.listarCarrinhos();
  }

  @Get('nps')
  @Roles(...GESTAO, Role.CASHIER)
  nps(@Query('marca') marca?: string) {
    return this.retencao.resultadoNps(marca || undefined);
  }

  /** Como está a fila — útil para ver o disparo acontecendo. */
  @Get('filas')
  @Roles(...GESTAO)
  async filas() {
    const nomes = Object.values(FILAS);
    return Promise.all(nomes.map((n) => this.fila.situacao(n)));
  }
}
