import { Injectable, NotImplementedException } from '@nestjs/common';
import { Address, GeoPoint, MapProvider, RouteResult } from './map.port';

/** ADAPTADOR FAKE de mapa — vazio. Vira real na Etapa 7. */
@Injectable()
export class FakeMapProvider implements MapProvider {
  async geocode(_address: Address): Promise<GeoPoint | null> {
    throw new NotImplementedException('Mapa fake ainda não implementado (Etapa 7).');
  }

  async route(_from: GeoPoint, _to: GeoPoint): Promise<RouteResult> {
    throw new NotImplementedException('Mapa fake ainda não implementado (Etapa 7).');
  }

  async estimateDeliveryCostCents(_from: GeoPoint, _to: GeoPoint): Promise<number> {
    throw new NotImplementedException('Mapa fake ainda não implementado (Etapa 7).');
  }
}
