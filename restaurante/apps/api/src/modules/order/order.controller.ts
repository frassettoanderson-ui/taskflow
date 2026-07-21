import { Body, Controller, Get, Param, Patch, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { IsEnum } from 'class-validator';
import { OrderStatus, Role } from '@prisma/client';
import { OrderService } from './order.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequestContext } from '../../common/tenant/tenant-context.service';
import { Roles } from '../../common/auth/roles.decorator';

class MudarStatusDto {
  @IsEnum(OrderStatus, { message: 'Situação de pedido inválida.' })
  status: OrderStatus;
}

/**
 * Rotas do painel — exigem login. É o que a tela da cozinha (KDS) usa.
 */
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Pedidos em andamento do restaurante logado. */
  @Get('kds')
  kds() {
    return this.orders.listarParaCozinha();
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

  /** Tempo real da cozinha: pedidos novos e mudanças aparecem sozinhos. */
  @Sse('stream')
  stream(@CurrentUser() user: RequestContext): Observable<MessageEvent> {
    return this.realtime.streamDoTenant(user.tenantId);
  }
}
