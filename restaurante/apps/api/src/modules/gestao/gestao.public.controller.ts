import { Controller, Get, Param } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { Public } from '../../common/auth/public.decorator';

/**
 * Rastreio da entrega — o link que o cliente recebe.
 * Sem login: quem tem o código vê onde está o pedido.
 */
@Controller('public/entrega')
export class GestaoPublicController {
  constructor(private readonly entregas: DeliveryService) {}

  @Public()
  @Get(':codigo')
  rastrear(@Param('codigo') codigo: string) {
    return this.entregas.rastrear(codigo);
  }
}
