import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { Charge, CreateChargeInput, PaymentProvider } from './payment.port';

/**
 * ADAPTADOR FAKE de pagamento — vazio nesta Etapa 0.
 *
 * Na Etapa 1 ele vira o "FakePix": gera um QR Code de mentira e um botão
 * "simular pagamento aprovado". Gateway de verdade só na Etapa 7.
 */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(FakePaymentProvider.name);

  async createCharge(_input: CreateChargeInput): Promise<Charge> {
    throw new NotImplementedException('Pagamento fake ainda não implementado (Etapa 1).');
  }

  async getCharge(_chargeId: string): Promise<Charge> {
    throw new NotImplementedException('Pagamento fake ainda não implementado (Etapa 1).');
  }

  async handleWebhook(
    _payload: unknown,
  ): Promise<{ chargeId: string; status: Charge['status'] } | null> {
    throw new NotImplementedException('Pagamento fake ainda não implementado (Etapa 1).');
  }

  async refund(_chargeId: string, _amountCents?: number): Promise<Charge> {
    throw new NotImplementedException('Pagamento fake ainda não implementado (Etapa 1).');
  }
}
