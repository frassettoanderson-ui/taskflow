import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { ServiceCallType } from '@prisma/client';
import { SalaoService } from './salao.service';
import { PedidoDeMesaDto } from './dto/salao.dto';
import { Public } from '../../common/auth/public.decorator';
import { RealtimeService } from '../../common/realtime/realtime.service';

/**
 * O que o CLIENTE SENTADO NA MESA acessa — tudo sem login.
 * É o que abre quando ele aponta a câmera para o QR Code da mesa.
 */
@Controller('public/mesa')
export class SalaoPublicController {
  constructor(
    private readonly salao: SalaoService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Estado da mesa: qual marca, se tem comanda aberta e o que já foi pedido. */
  @Public()
  @Get(':qrToken')
  estado(@Param('qrToken') qrToken: string) {
    return this.salao.estadoDaMesaPublico(qrToken);
  }

  /** O cliente manda uma rodada de pedido. Vai direto para a cozinha. */
  @Public()
  @Post(':qrToken/pedido')
  pedir(@Param('qrToken') qrToken: string, @Body() dto: PedidoDeMesaDto) {
    return this.salao.pedirNaMesa(qrToken, {
      itens: dto.itens,
      nome: dto.nome,
      notes: dto.notes,
      pessoas: dto.pessoas,
    });
  }

  /** Botão "Chamar garçom". */
  @Public()
  @Post(':qrToken/chamar-garcom')
  chamarGarcom(@Param('qrToken') qrToken: string) {
    return this.salao.chamar(qrToken, ServiceCallType.WAITER);
  }

  /** Botão "Pedir a conta". */
  @Public()
  @Post(':qrToken/pedir-conta')
  pedirConta(@Param('qrToken') qrToken: string) {
    return this.salao.chamar(qrToken, ServiceCallType.BILL);
  }

  /**
   * Tempo real da mesa: quando a cozinha avança um prato ou o caixa recebe
   * um pagamento, a tela do cliente se atualiza sozinha.
   */
  @Public()
  @Sse(':qrToken/stream')
  stream(@Param('qrToken') qrToken: string): Observable<MessageEvent> {
    return from(this.salao.estadoDaMesaPublico(qrToken)).pipe(
      switchMap((estado) => this.realtime.streamDaMesa(estado.mesa.id)),
    );
  }
}
