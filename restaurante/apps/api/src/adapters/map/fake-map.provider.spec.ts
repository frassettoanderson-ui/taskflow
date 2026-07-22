import { distanciaEmKm, FakeMapProvider } from './fake-map.provider';

describe('Mapa fake (distância e bairros)', () => {
  const mapa = new FakeMapProvider();
  const cozinha = { lat: -28.24, lng: -48.67 }; // Centro de Imbituba

  it('a distância de um ponto até ele mesmo é zero', () => {
    expect(distanciaEmKm(cozinha, cozinha)).toBeCloseTo(0, 5);
  });

  it('reconhece bairro escrito com acento, sem acento e em maiúsculas', async () => {
    const a = await mapa.geocode({ street: 'x', district: 'Ibiraquera', city: 'Imbituba', state: 'SC' });
    const b = await mapa.geocode({ street: 'x', district: 'IBIRAQUERA', city: 'Imbituba', state: 'SC' });
    const c = await mapa.geocode({ street: 'x', district: ' ibiraquera ', city: 'Imbituba', state: 'SC' });

    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('bairro que não conhece devolve vazio (e o pedido é recusado lá na frente)', async () => {
    const p = await mapa.geocode({ street: 'x', district: 'Bairro Inventado', city: 'Imbituba', state: 'SC' });
    expect(p).toBeNull();
  });

  it('bairro perto fica dentro de 3 km e bairro longe passa de 10 km', async () => {
    const perto = await mapa.geocode({ street: 'x', district: 'Praia da Vila', city: 'Imbituba', state: 'SC' });
    const longe = await mapa.geocode({ street: 'x', district: 'Ibiraquera', city: 'Imbituba', state: 'SC' });

    expect(distanciaEmKm(cozinha, perto!)).toBeLessThan(3);
    expect(distanciaEmKm(cozinha, longe!)).toBeGreaterThan(10);
  });

  it('a distância é a mesma nos dois sentidos', async () => {
    const p = await mapa.geocode({ street: 'x', district: 'Mirim', city: 'Imbituba', state: 'SC' });
    expect(distanciaEmKm(cozinha, p!)).toBeCloseTo(distanciaEmKm(p!, cozinha), 6);
  });
});
