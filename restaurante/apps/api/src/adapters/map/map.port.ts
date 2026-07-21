/**
 * PORTA: mapa, rota e cálculo de frete.
 * Sustenta a área de entrega por bairro/raio e o markup do frete.
 */

export const MAP_PROVIDER = 'MAP_PROVIDER';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  street: string;
  number?: string;
  district?: string;
  city: string;
  state: string;
  zipCode?: string;
  complement?: string;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
}

export interface MapProvider {
  /** Endereço em texto -> coordenadas. */
  geocode(address: Address): Promise<GeoPoint | null>;

  /** Distância e tempo entre dois pontos. */
  route(from: GeoPoint, to: GeoPoint): Promise<RouteResult>;

  /** Custo da entrega em CENTAVOS (antes do markup da plataforma). */
  estimateDeliveryCostCents(from: GeoPoint, to: GeoPoint): Promise<number>;
}
