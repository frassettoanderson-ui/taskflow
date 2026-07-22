import { Global, Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingPublicController } from './marketing.public.controller';
import { CrmService } from './crm.service';
import { CashbackCodeService } from './cashback-code.service';
import { LoyaltyService } from './loyalty.service';
import { CouponService } from './coupon.service';
import { CampaignService } from './campaign.service';
import { RetentionService } from './retention.service';
import { MessagingService } from './messaging.service';

/**
 * CRM, fidelidade e marketing.
 *
 * É @Global porque o módulo de pedido precisa de cupom, cashback e retenção
 * na hora de fechar o pedido — e o caminho contrário não existe, então não há
 * risco de laço.
 */
@Global()
@Module({
  controllers: [MarketingController, MarketingPublicController],
  providers: [
    CrmService,
    LoyaltyService,
    CashbackCodeService,
    CouponService,
    CampaignService,
    RetentionService,
    MessagingService,
  ],
  exports: [
    CrmService,
    LoyaltyService,
    CashbackCodeService,
    CouponService,
    CampaignService,
    RetentionService,
    MessagingService,
  ],
})
export class MarketingModule {}
