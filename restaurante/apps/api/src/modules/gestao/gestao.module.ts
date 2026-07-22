import { Global, Module } from '@nestjs/common';
import { GestaoController } from './gestao.controller';
import { GestaoPublicController } from './gestao.public.controller';
import { ReportService } from './report.service';
import { StockService } from './stock.service';
import { FinanceService } from './finance.service';
import { DeliveryService } from './delivery.service';
import { LgpdService } from './lgpd.service';

/**
 * Bastidores: relatórios, estoque, financeiro, entregadores e LGPD.
 *
 * É @Global porque o módulo de pedido precisa avisar o estoque e o financeiro
 * quando um pedido é aceito, pago ou cancelado.
 */
@Global()
@Module({
  controllers: [GestaoController, GestaoPublicController],
  providers: [ReportService, StockService, FinanceService, DeliveryService, LgpdService],
  exports: [ReportService, StockService, FinanceService, DeliveryService, LgpdService],
})
export class GestaoModule {}
