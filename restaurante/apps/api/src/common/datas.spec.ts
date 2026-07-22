import { fimDoDia, inicioDoDia, paraTextoLocal } from './datas';

/**
 * Estes testes existem por causa de um bug REAL que apareceu na Etapa 5:
 * o acerto do motoboy procurava as entregas do dia anterior porque
 * `new Date('2026-07-22')` é meia-noite em UTC — 21h do dia 21 no Brasil.
 */
describe('Datas no fuso local', () => {
  it('"2026-07-22" começa às 00:00 do dia 22, não do dia 21', () => {
    const d = inicioDoDia('2026-07-22');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // julho
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('"2026-07-22" termina às 23:59:59 do dia 22', () => {
    const d = fimDoDia('2026-07-22');
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  it('o intervalo de um dia só contém aquele dia inteiro', () => {
    const de = inicioDoDia('2026-07-22');
    const ate = fimDoDia('2026-07-22');

    const cedo = new Date(2026, 6, 22, 0, 0, 1);
    const tarde = new Date(2026, 6, 22, 23, 30, 0);
    const ontem = new Date(2026, 6, 21, 23, 30, 0);
    const amanha = new Date(2026, 6, 23, 0, 30, 0);

    expect(cedo >= de && cedo <= ate).toBe(true);
    expect(tarde >= de && tarde <= ate).toBe(true);
    expect(ontem >= de && ontem <= ate).toBe(false);
    expect(amanha >= de && amanha <= ate).toBe(false);
  });

  it('um pedido das 22h continua sendo do MESMO dia', () => {
    // Com toISOString isto viraria o dia seguinte no fuso do Brasil.
    const pedido = new Date(2026, 6, 22, 22, 30, 0);
    expect(paraTextoLocal(pedido)).toBe('2026-07-22');
  });

  it('ida e volta entre texto e data não perde o dia', () => {
    for (const texto of ['2026-01-01', '2026-07-22', '2026-12-31']) {
      expect(paraTextoLocal(inicioDoDia(texto))).toBe(texto);
      expect(paraTextoLocal(fimDoDia(texto))).toBe(texto);
    }
  });

  it('sem texto, usa hoje', () => {
    const hoje = new Date();
    expect(paraTextoLocal(inicioDoDia())).toBe(paraTextoLocal(hoje));
  });
});
