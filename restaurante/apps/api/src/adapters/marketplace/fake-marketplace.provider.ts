import { Injectable, NotImplementedException } from '@nestjs/common';
import { ExternalMenuItem, ExternalOrder, MarketplaceImport } from './marketplace.port';

/** ADAPTADOR FAKE de marketplace (iFood) — vazio. Vira real na Etapa 7. */
@Injectable()
export class FakeMarketplaceProvider implements MarketplaceImport {
  async importMenu(_tenantId: string, _brandId: string): Promise<ExternalMenuItem[]> {
    throw new NotImplementedException('Importação de marketplace ainda não implementada (Etapa 7).');
  }

  async pullOrders(_tenantId: string, _brandId: string): Promise<ExternalOrder[]> {
    throw new NotImplementedException('Importação de marketplace ainda não implementada (Etapa 7).');
  }

  async acknowledgeOrder(_externalId: string): Promise<void> {
    throw new NotImplementedException('Importação de marketplace ainda não implementada (Etapa 7).');
  }
}
