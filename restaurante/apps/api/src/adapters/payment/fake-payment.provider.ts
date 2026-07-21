import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Charge, CreateChargeInput, PaymentProvider } from './payment.port';

/**
 * ADAPTADOR FAKE DE PAGAMENTO — o "FakePix".
 *
 * Ele finge ser um gateway (Mercado Pago, Stone, etc.): gera uma cobrança com
 * um código Pix de mentira e responde a avisos de pagamento. Nada de dinheiro
 * de verdade, nenhuma conta em serviço externo.
 *
 * O importante é a FORMA: quando chegar a Etapa 7, trocar isto por um gateway
 * real mexe só neste arquivo — o resto do sistema não fica sabendo.
 */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(FakePaymentProvider.name);

  /** Memória do "gateway" de mentira. A verdade oficial fica no banco. */
  private readonly cobrancas = new Map<string, Charge>();

  async createCharge(input: CreateChargeInput): Promise<Charge> {
    const id = `pix_${randomUUID().replace(/-/g, '').slice(0, 20)}`;

    // Um "copia e cola" com cara de Pix — só para a tela ficar realista.
    const qrCode = [
      '00020126',
      `br.gov.bcb.pix.FAKE.${input.orderId}`,
      `5204000053039865802BR`,
      `54${String(input.amountCents / 100).padStart(6, '0')}`,
      `6304${id.slice(-4).toUpperCase()}`,
    ].join('');

    const cobranca: Charge = {
      id,
      status: 'PENDING',
      amountCents: input.amountCents,
      qrCode,
    };

    this.cobrancas.set(id, cobranca);

    // Conferência de sanidade: a divisão precisa fechar com o total.
    const somaSplits = input.splits.reduce((s, r) => s + r.amountCents, 0);
    if (somaSplits !== input.amountCents) {
      this.logger.warn(
        `Divisão não fecha no pedido ${input.orderId}: splits ${somaSplits} x total ${input.amountCents}`,
      );
    }

    this.logger.log(
      `Cobrança fake criada (${id}) de ${input.amountCents} centavos — divisão: ` +
        input.splits.map((s) => `${s.kind}=${s.amountCents}`).join(', '),
    );

    return cobranca;
  }

  async getCharge(chargeId: string): Promise<Charge> {
    const c = this.cobrancas.get(chargeId);
    if (!c) throw new NotFoundException('Cobrança não encontrada no gateway fake.');
    return c;
  }

  /**
   * Traduz o aviso do "gateway" para o formato que o sistema entende.
   * Quem garante que o mesmo aviso não seja processado duas vezes é o
   * PaymentService (tabela processed_webhooks).
   */
  async handleWebhook(
    payload: unknown,
  ): Promise<{ chargeId: string; status: Charge['status'] } | null> {
    const p = payload as { chargeId?: string; status?: Charge['status'] };
    if (!p?.chargeId || !p?.status) return null;

    const existente = this.cobrancas.get(p.chargeId);
    if (existente) existente.status = p.status;

    return { chargeId: p.chargeId, status: p.status };
  }

  async refund(chargeId: string, _amountCents?: number): Promise<Charge> {
    const c = await this.getCharge(chargeId);
    c.status = 'REFUNDED';
    return c;
  }
}
