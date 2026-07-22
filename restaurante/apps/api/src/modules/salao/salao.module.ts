import { forwardRef, Module } from '@nestjs/common';
import { SalaoController } from './salao.controller';
import { SalaoPublicController } from './salao.public.controller';
import { SalaoService } from './salao.service';
import { OrderModule } from '../order/order.module';

/**
 * O salão usa o módulo de pedido (para lançar as rodadas na cozinha) e o de
 * pagamento (para receber a conta). O forwardRef existe porque o pagamento
 * também precisa avisar o salão quando uma parte da conta é quitada.
 */
@Module({
  imports: [forwardRef(() => OrderModule)],
  controllers: [SalaoController, SalaoPublicController],
  providers: [SalaoService],
  exports: [SalaoService],
})
export class SalaoModule {}
