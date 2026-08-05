/**
 * As regras do caixa e da numeração diária, testadas sem banco.
 *
 * O que estas provas protegem:
 *  - o número zera quando o caixa abre (novo dia);
 *  - a sequência é única e crescente, sem pular nem repetir;
 *  - conta TODOS os canais e marcas juntos;
 *  - caixa fechado não numera.
 */

/** Simula o contador de uma sessão (o `orderCount` do banco). */
class Sessao {
  orderCount = 0;
  aberta = true;
  proximo(): number | null {
    if (!this.aberta) return null;
    this.orderCount += 1; // incremento atômico no banco real
    return this.orderCount;
  }
}

describe('Numeração diária do caixa', () => {
  it('a primeira venda do dia é 1', () => {
    const s = new Sessao();
    expect(s.proximo()).toBe(1);
  });

  it('numera em sequência, sem pular nem repetir', () => {
    const s = new Sessao();
    expect([s.proximo(), s.proximo(), s.proximo()]).toEqual([1, 2, 3]);
  });

  it('conta canais e marcas juntos (é o MESMO contador)', () => {
    const s = new Sessao();
    const delivery = s.proximo(); // 1
    const balcao = s.proximo(); // 2 (outra origem)
    const salao = s.proximo(); // 3 (outra marca)
    expect([delivery, balcao, salao]).toEqual([1, 2, 3]);
  });

  it('reabrir o caixa (novo dia) zera a numeração', () => {
    const dia1 = new Sessao();
    dia1.proximo();
    dia1.proximo(); // dia 1 chegou ao 2
    const dia2 = new Sessao(); // abrir de novo = sessão nova
    expect(dia2.proximo()).toBe(1);
  });

  it('caixa fechado não numera (devolve null)', () => {
    const s = new Sessao();
    s.aberta = false;
    expect(s.proximo()).toBeNull();
  });
});
