import { Global, Module } from '@nestjs/common';
import { OperationService } from './operation.service';

/**
 * Regras de operação (horários, área de entrega, frete e pausa).
 * É @Global porque tanto o cardápio quanto o pedido precisam consultar.
 */
@Global()
@Module({
  providers: [OperationService],
  exports: [OperationService],
})
export class OperationModule {}
