/**
 * A conta dividida NUNCA pode perder nem inventar centavo.
 *
 * Esta é a mesma regra usada no controller: N-1 partes iguais e a última leva
 * a sobra do arredondamento.
 */
function dividir(faltaCents: number, partes: number): number[] {
  const base = Math.floor(faltaCents / partes);
  const sobra = faltaCents - base * partes;
  return Array.from({ length: partes }, (_, i) => (i === partes - 1 ? base + sobra : base));
}

/** Taxa de serviço: 1000 bps = 10%. */
function comTaxa(subtotalCents: number, bps: number, ligada: boolean) {
  const taxa = ligada ? Math.round((subtotalCents * bps) / 10000) : 0;
  return { taxa, total: subtotalCents + taxa };
}

describe('Divisão da conta da mesa', () => {
  it('valor redondo divide igual', () => {
    expect(dividir(30000, 3)).toEqual([10000, 10000, 10000]);
  });

  it('quando não divide exato, a última parte leva a sobra', () => {
    const partes = dividir(10000, 3);
    expect(partes).toEqual([3333, 3333, 3334]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('a soma sempre fecha com o total, em qualquer combinação', () => {
    for (let total = 1; total <= 500; total += 7) {
      for (let n = 2; n <= 10; n++) {
        const partes = dividir(total, n);
        expect(partes.reduce((a, b) => a + b, 0)).toBe(total);
        expect(partes).toHaveLength(n);
        expect(partes.every((p) => p >= 0)).toBe(true);
      }
    }
  });

  it('dividir em 2 uma conta de R$ 252,12 dá R$ 126,06 para cada', () => {
    expect(dividir(25212, 2)).toEqual([12606, 12606]);
  });
});

describe('Taxa de serviço', () => {
  it('10% sobre R$ 229,20 são R$ 22,92', () => {
    const r = comTaxa(22920, 1000, true);
    expect(r.taxa).toBe(2292);
    expect(r.total).toBe(25212);
  });

  it('desligada, o total é só o consumo', () => {
    const r = comTaxa(22920, 1000, false);
    expect(r.taxa).toBe(0);
    expect(r.total).toBe(22920);
  });

  it('arredonda para o centavo mais próximo, sem casa decimal perdida', () => {
    // R$ 33,33 com 10% = R$ 3,333 -> arredonda para R$ 3,33
    expect(comTaxa(3333, 1000, true).taxa).toBe(333);
    // R$ 33,35 com 10% = R$ 3,335 -> arredonda para R$ 3,34
    expect(comTaxa(3335, 1000, true).taxa).toBe(334);
  });

  it('percentual configurável: 12% em vez de 10%', () => {
    expect(comTaxa(10000, 1200, true).taxa).toBe(1200);
  });
});
