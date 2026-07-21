/**
 * PORTA: nota fiscal (NF-e / NFC-e).
 */

export const FISCAL_PROVIDER = 'FISCAL_PROVIDER';

export interface InvoiceInput {
  tenantId: string;
  orderId: string;
  /** total em centavos */
  amountCents: number;
  customer?: { name: string; document?: string };
}

export interface Invoice {
  id: string;
  status: 'PENDING' | 'ISSUED' | 'REJECTED' | 'CANCELED';
  /** chave de acesso da nota */
  accessKey?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  rejectionReason?: string;
}

export interface FiscalProvider {
  issue(input: InvoiceInput): Promise<Invoice>;
  get(invoiceId: string): Promise<Invoice>;
  cancel(invoiceId: string, reason: string): Promise<Invoice>;
}
