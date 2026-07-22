import { Global, Module } from '@nestjs/common';

import { PAYMENT_PROVIDER } from './payment/payment.port';
import { FakePaymentProvider } from './payment/fake-payment.provider';
import { MESSAGING_PROVIDER } from './messaging/messaging.port';
import { FakeMessagingProvider } from './messaging/fake-messaging.provider';
import { MAP_PROVIDER } from './map/map.port';
import { FakeMapProvider } from './map/fake-map.provider';
import { FISCAL_PROVIDER } from './fiscal/fiscal.port';
import { FakeFiscalProvider } from './fiscal/fake-fiscal.provider';
import { MARKETPLACE_IMPORT } from './marketplace/marketplace.port';
import { FakeMarketplaceProvider } from './marketplace/fake-marketplace.provider';
import { DELIVERY_PROVIDER } from './delivery/delivery.port';
import { FakeDeliveryProvider } from './delivery/fake-delivery.provider';
import { BILLING_PROVIDER } from './billing/billing.port';
import { FakeBillingProvider } from './billing/fake-billing.provider';

/**
 * Aqui é onde escolhemos QUAL aparelho está plugado em cada tomada.
 *
 * Hoje todos são fakes. Trocar por um serviço de verdade, na Etapa 7, é mudar
 * uma linha aqui — o resto do sistema nem fica sabendo.
 */
@Global()
@Module({
  providers: [
    { provide: PAYMENT_PROVIDER, useClass: FakePaymentProvider },
    { provide: MESSAGING_PROVIDER, useClass: FakeMessagingProvider },
    { provide: MAP_PROVIDER, useClass: FakeMapProvider },
    { provide: FISCAL_PROVIDER, useClass: FakeFiscalProvider },
    { provide: MARKETPLACE_IMPORT, useClass: FakeMarketplaceProvider },
    { provide: DELIVERY_PROVIDER, useClass: FakeDeliveryProvider },
    { provide: BILLING_PROVIDER, useClass: FakeBillingProvider },
  ],
  exports: [
    PAYMENT_PROVIDER,
    MESSAGING_PROVIDER,
    MAP_PROVIDER,
    FISCAL_PROVIDER,
    MARKETPLACE_IMPORT,
    DELIVERY_PROVIDER,
    BILLING_PROVIDER,
  ],
})
export class AdaptersModule {}
