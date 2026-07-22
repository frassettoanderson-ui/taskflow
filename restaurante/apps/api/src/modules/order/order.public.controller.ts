import { Body, Controller, Get, Param, Post, Query, Sse } from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Public } from '../../common/auth/public.decorator';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { lerCanal } from '../operation/channel';

/**
 * Rotas que o CLIENTE usa — todas sem login e sem cadastro.
 */
@Controller('public')
export class OrderPublicController {
  constructor(
    private readonly orders: OrderService,
    private readonly payments: PaymentService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Fecha o pedido.
   * POST /api/public/orders/cantina-da-nona
   * POST /api/public/orders/cantina-da-nona?canal=salao
   */
  @Public()
  @Post('orders/:brandSlug')
  criar(
    @Param('brandSlug') brandSlug: string,
    @Body() dto: CreateOrderDto,
    @Query('canal') canal?: string,
  ) {
    return this.orders.criarPedidoPublico(brandSlug, dto, lerCanal(canal));
  }

  /** Acompanhamento. GET /api/public/orders/A7K2QD */
  @Public()
  @Get('orders/:code')
  buscar(@Param('code') code: string) {
    return this.orders.buscarPorCodigoPublico(code);
  }

  /** Gera (ou devolve) o Pix do pedido. */
  @Public()
  @Post('orders/:code/pagamento')
  cobranca(@Param('code') code: string) {
    return this.payments.criarCobranca(code);
  }

  /**
   * ⚠️ SÓ EM DESENVOLVIMENTO: finge que o cliente pagou.
   *
   * Monta um aviso igual ao que um gateway de verdade mandaria e joga no mesmo
   * caminho do webhook — assim testamos o fluxo inteiro, inclusive a proteção
   * contra aviso repetido.
   */
  @Public()
  @Post('orders/:code/simular-pagamento')
  async simularPagamento(@Param('code') code: string, @Query('repetir') repetir?: string) {
    const pedido = await this.orders.buscarPorCodigoPublico(code);
    const cobranca = await this.payments.criarCobranca(code);

    const eventId = repetir === 'sim' ? `evt-fixo-${pedido.code}` : `evt-${randomUUID()}`;

    return this.payments.processarWebhook({
      eventId,
      chargeId: cobranca.chargeId,
      status: 'PAID',
    });
  }

  /** Entrada oficial dos avisos do gateway. */
  @Public()
  @Post('payments/webhook')
  webhook(@Body() payload: { eventId: string; chargeId: string; status: string }) {
    return this.payments.processarWebhook(payload);
  }

  /** Cross-sell: "quem pediu isto também levou...". */
  @Public()
  @Get('menu/:brandSlug/sugestoes')
  sugestoes(@Param('brandSlug') brandSlug: string, @Query('itemIds') itemIds?: string) {
    const ids = (itemIds ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.orders.sugestoes(brandSlug, ids);
  }

  /**
   * Tempo real do acompanhamento: a tela do cliente fica "ouvindo" aqui e se
   * atualiza sozinha quando a cozinha mexe no pedido.
   */
  @Public()
  @Sse('orders/:code/stream')
  stream(@Param('code') code: string): Observable<MessageEvent> {
    return from(this.orders.idPorCodigo(code)).pipe(
      switchMap((orderId) => this.realtime.streamDoPedido(orderId)),
    );
  }
}
