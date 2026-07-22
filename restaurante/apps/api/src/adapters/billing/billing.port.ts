/**
 * PORTA: cobrança da ASSINATURA do SaaS.
 *
 * Não confundir com o PaymentProvider: aquele cobra o CONSUMIDOR pelo pedido;
 * este cobra o RESTAURANTE pela mensalidade do sistema.
 */

export const BILLING_PROVIDER = 'BILLING_PROVIDER';

export interface AssinaturaExterna {
  id: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
}

export interface FaturaExterna {
  id: string;
  status: 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELED';
  amountCents: number;
  /** link para o restaurante pagar (boleto, Pix, cartão) */
  paymentUrl?: string;
}

export interface CriarAssinaturaInput {
  tenantId: string;
  tenantName: string;
  planCode: string;
  monthlyPriceCents: number;
  /** dias de teste grátis */
  trialDays?: number;
}

export interface BillingProvider {
  /** Cria a assinatura no cobrador. */
  criarAssinatura(input: CriarAssinaturaInput): Promise<AssinaturaExterna>;

  /** Troca de plano. */
  trocarPlano(externalId: string, planCode: string, monthlyPriceCents: number): Promise<AssinaturaExterna>;

  /** Cancela. */
  cancelar(externalId: string): Promise<AssinaturaExterna>;

  /** Emite a fatura do mês. */
  emitirFatura(input: {
    subscriptionExternalId: string;
    amountCents: number;
    periodFrom: Date;
    periodTo: Date;
    dueDate: Date;
  }): Promise<FaturaExterna>;

  /**
   * Processa o aviso do cobrador ("a fatura foi paga").
   * DEVE ser idempotente.
   */
  handleWebhook(payload: unknown): Promise<{ invoiceExternalId: string; status: FaturaExterna['status'] } | null>;
}
