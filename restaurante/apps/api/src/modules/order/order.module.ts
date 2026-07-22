import { forwardRef, Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderPublicController } from './order.public.controller';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { SalaoModule } from '../salao/salao.module';

@Module({
  imports: [forwardRef(() => SalaoModule)],
  controllers: [OrderController, OrderPublicController],
  providers: [OrderService, PaymentService],
  exports: [OrderService, PaymentService],
})
export class OrderModule {}
