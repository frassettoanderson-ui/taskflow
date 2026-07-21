import { Injectable, NotImplementedException } from '@nestjs/common';
import { FiscalProvider, Invoice, InvoiceInput } from './fiscal.port';

/** ADAPTADOR FAKE de nota fiscal — vazio. Vira real na Etapa 7. */
@Injectable()
export class FakeFiscalProvider implements FiscalProvider {
  async issue(_input: InvoiceInput): Promise<Invoice> {
    throw new NotImplementedException('Nota fiscal fake ainda não implementada (Etapa 7).');
  }

  async get(_invoiceId: string): Promise<Invoice> {
    throw new NotImplementedException('Nota fiscal fake ainda não implementada (Etapa 7).');
  }

  async cancel(_invoiceId: string, _reason: string): Promise<Invoice> {
    throw new NotImplementedException('Nota fiscal fake ainda não implementada (Etapa 7).');
  }
}
