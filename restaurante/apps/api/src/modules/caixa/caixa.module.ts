import { Global, Module } from '@nestjs/common';
import { CaixaController } from './caixa.controller';
import { CaixaService } from './caixa.service';

/**
 * O caixa do dia. @Global porque o módulo de pedido precisa numerar os pedidos
 * (e o de balcão também), e um caixa não depende de ninguém — não há laço.
 */
@Global()
@Module({
  controllers: [CaixaController],
  providers: [CaixaService],
  exports: [CaixaService],
})
export class CaixaModule {}
