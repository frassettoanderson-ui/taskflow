import { Global, Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalPublicController } from './portal.public.controller';
import { PortalService } from './portal.service';
import { PortalOrderService } from './portal-order.service';
import { NetworkWalletService } from './network-wallet.service';
import { GraduationService } from './graduation.service';
import { BillingService } from './billing.service';
import { LimitesService } from './limites.service';
import { OrderModule } from '../order/order.module';

/**
 * O PORTAL — o marketplace da rede.
 *
 * Depende do módulo de pedido (para criar o pedido dentro do tenant dono) e
 * do de marketing (mensagem do funil de graduação, que é @Global). Nada
 * depende do portal, então não há laço.
 */
@Global()
@Module({
  imports: [OrderModule],
  controllers: [PortalController, PortalPublicController],
  providers: [
    PortalService,
    PortalOrderService,
    NetworkWalletService,
    GraduationService,
    BillingService,
    LimitesService,
  ],
  exports: [PortalService, NetworkWalletService, BillingService, LimitesService],
})
export class PortalModule {}
