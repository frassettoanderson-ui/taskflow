import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';

/**
 * A fila é @Global: campanhas, carrinho abandonado e NPS usam a mesma.
 */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
