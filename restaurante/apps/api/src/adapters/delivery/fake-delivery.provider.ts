import { Injectable, NotImplementedException } from '@nestjs/common';
import { DeliveryProvider, Dispatch, DispatchInput } from './delivery.port';

/** ADAPTADOR FAKE de entrega — vazio. Vira real na Etapa 7. */
@Injectable()
export class FakeDeliveryProvider implements DeliveryProvider {
  async dispatch(_input: DispatchInput): Promise<Dispatch> {
    throw new NotImplementedException('Despacho de entregador ainda não implementado (Etapa 7).');
  }

  async get(_dispatchId: string): Promise<Dispatch> {
    throw new NotImplementedException('Despacho de entregador ainda não implementado (Etapa 7).');
  }

  async cancel(_dispatchId: string, _reason: string): Promise<Dispatch> {
    throw new NotImplementedException('Despacho de entregador ainda não implementado (Etapa 7).');
  }
}
