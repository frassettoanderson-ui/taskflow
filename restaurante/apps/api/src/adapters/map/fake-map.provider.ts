import { Injectable, Logger } from '@nestjs/common';
import { Address, GeoPoint, MapProvider, RouteResult } from './map.port';

/**
 * ADAPTADOR FAKE DE MAPA.
 *
 * Ele finge ser o Google Maps: transforma endereço em coordenadas e calcula
 * distância. Como ainda não pode haver conta em serviço externo (só na Etapa 7),
 * ele usa uma tabelinha de bairros de Imbituba/SC embutida aqui.
 *
 * DUAS LIMITAÇÕES, ditas na cara:
 *   1) só conhece os bairros da tabela abaixo;
 *   2) mede em LINHA RETA, não pelas ruas. Um mapa de verdade dá uns 20-30%
 *      a mais. Trocar por um provedor real mexe só neste arquivo.
 */
@Injectable()
export class FakeMapProvider implements MapProvider {
  private readonly logger = new Logger(FakeMapProvider.name);

  /** Bairros conhecidos (minúsculo, sem acento) -> coordenadas. */
  private readonly bairros: Record<string, GeoPoint> = {
    centro: { lat: -28.24, lng: -48.67 },
    'praia da vila': { lat: -28.232, lng: -48.656 },
    'vila nova': { lat: -28.228, lng: -48.68 },
    divineia: { lat: -28.25, lng: -48.66 },
    mirim: { lat: -28.21, lng: -48.69 },
    'alto arroio': { lat: -28.2, lng: -48.71 },
    aracatuba: { lat: -28.19, lng: -48.66 },
    ibiraquera: { lat: -28.16, lng: -48.73 },
    "campo d'una": { lat: -28.13, lng: -48.75 },
    'campo duna': { lat: -28.13, lng: -48.75 },
  };

  /** Tira acento e deixa minúsculo, para comparar sem depender de digitação. */
  private normalizar(texto: string) {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toLowerCase();
  }

  async geocode(address: Address): Promise<GeoPoint | null> {
    if (!address?.district) return null;

    const chave = this.normalizar(address.district);
    const ponto = this.bairros[chave];

    if (!ponto) {
      this.logger.debug(`Bairro desconhecido para o mapa fake: "${address.district}"`);
      return null;
    }
    return ponto;
  }

  async route(from: GeoPoint, to: GeoPoint): Promise<RouteResult> {
    const metros = Math.round(distanciaEmKm(from, to) * 1000);
    // Chute de 25 km/h em cidade — só para a resposta ter a forma certa.
    return { distanceMeters: metros, durationSeconds: Math.round((metros / 1000 / 25) * 3600) };
  }

  async estimateDeliveryCostCents(from: GeoPoint, to: GeoPoint): Promise<number> {
    // Custo bruto de logística. O que o cliente paga sai das regras de área
    // de entrega da marca, não daqui.
    const km = distanciaEmKm(from, to);
    return Math.round(300 + km * 150); // R$ 3,00 fixo + R$ 1,50/km
  }
}

/**
 * Distância em linha reta entre dois pontos do globo (fórmula de Haversine).
 * É a conta padrão para "quantos km tem daqui até lá".
 */
export function distanciaEmKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371; // raio da Terra em km
  const rad = (g: number) => (g * Math.PI) / 180;

  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}
