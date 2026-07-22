import { Body, Controller, Get, Param, Patch, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { IsEnum } from 'class-validator';
import { OrderStatus, Role, SalesChannel } from '@prisma/client';
import { OrderService } from './order.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequestContext } from '../../common/tenant/tenant-context.service';
import { Roles } from '../../common/auth/roles.decorator';
import { lerCanal } from '../operation/channel';

class MudarStatusDto {
  @IsEnum(OrderStatus, { message: 'Situação de pedido inválida.' })
  status: OrderStatus;
}

/**
 * Rotas do painel — exigem login.
 * Servem o painel único de pedidos e a tela da cozinha (KDS).
 */
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * PAINEL ÚNICO — pedidos de TODAS as marcas, com filtros.
   * GET /api/orders?marca=<id>&canal=salao&situacao=READY
   */
  @Get()
  listar(
    @Query('marca') marca?: string,
    @Query('canal') canal?: string,
    @Query('situacao') situacao?: string,
    @Query('limite') limite?: string,
  ) {
    return this.orders.listarPedidos({
      brandId: marca || undefined,
      channel: canal ? lerCanal(canal) : undefined,
      status: (situacao as OrderStatus) || undefined,
      limite: limite ? Number(limite) : undefined,
    });
  }

  /**
   * Pedidos em andamento na cozinha.
   * GET /api/orders/kds?marca=<id>&estacao=<id>
   */
  @Get('kds')
  kds(@Query('marca') marca?: string, @Query('estacao') estacao?: string) {
    return this.orders.listarParaCozinha({
      brandId: marca || undefined,
      stationId: estacao || undefined,
    });
  }

  /** Estações de produção — as abas do KDS. */
  @Get('estacoes')
  estacoes() {
    return this.orders.listarEstacoes();
  }

  /** Base de clientes de UMA marca. */
  @Get('clientes/:brandId')
  clientes(@Param('brandId') brandId: string) {
    return this.orders.listarClientes(brandId);
  }

  /** Avança (ou cancela) o pedido. Operador também pode — é quem está na cozinha. */
  @Patch(':id/status')
  @Roles(Role.OWNER, Role.MANAGER, Role.OPERATOR)
  mudarStatus(
    @Param('id') id: string,
    @Body() dto: MudarStatusDto,
    @CurrentUser() user: RequestContext,
  ) {
    return this.orders.mudarStatus(id, dto.status, user.userId);
  }

  /** Tempo real: pedidos novos e mudanças de TODAS as marcas do tenant. */
  @Sse('stream')
  stream(@CurrentUser() user: RequestContext): Observable<MessageEvent> {
    return this.realtime.streamDoTenant(user.tenantId);
  }
}
