/**
 * PORTA: pagamento e divisão do dinheiro (split).
 *
 * O modelo do CLAUDE.md: a plataforma NÃO retém o valor. O gateway divide na
 * hora entre restaurante, plataforma e motoboy.
 */

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

/** Quem recebe um pedaço do dinheiro. */
export interface SplitRecipient {
  /** 'restaurant' | 'platform' | 'courier' */
  kind: 'restaurant' | 'platform' | 'courier';
  /** identificador do recebedor no gateway */
  externalId: string;
  /** valor em CENTAVOS (trabalhamos sempre em centavos, nunca com decimais) */
  amountCents: number;
}

export interface CreateChargeInput {
  tenantId: string;
  orderId: string;
  /** total em centavos */
  amountCents: number;
  method: 'PIX' | 'CARD' | 'CASH';
  splits: SplitRecipient[];
}

export interface Charge {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  amountCents: number;
  /** Pix: o "copia e cola" / imagem do QR Code */
  qrCode?: string;
  qrCodeImage?: string;
}

export interface PaymentProvider {
  /** Cria a cobrança. */
  createCharge(input: CreateChargeInput): Promise<Charge>;

  /** Consulta a situação de uma cobrança. */
  getCharge(chargeId: string): Promise<Charge>;

  /**
   * Processa o aviso que o gateway manda quando algo muda.
   * DEVE ser idempotente: se chegar duas vezes, não pode cobrar/creditar de novo.
   */
  handleWebhook(payload: unknown): Promise<{ chargeId: string; status: Charge['status'] } | null>;

  /** Estorna. */
  refund(chargeId: string, amountCents?: number): Promise<Charge>;
}
