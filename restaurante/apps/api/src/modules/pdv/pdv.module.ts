import { Module } from '@nestjs/common';
import { PdvController } from './pdv.controller';
import { PdvService } from './pdv.service';
import { OrderModule } from '../order/order.module';

/**
 * PDV — o caixa do balcão.
 *
 * Não reimplementa nada do pedido: importa o OrderModule e usa os mesmos
 * ajudantes de montar linhas, conferir preço e gerar código. O que é só dele é
 * o momento do pagamento (agora) e o fechamento de caixa do dia.
 */
@Module({
  imports: [OrderModule],
  controllers: [PdvController],
  providers: [PdvService],
})
export class PdvModule {}
