/**
 * As regras do caixa do balcão, testadas sem banco.
 *
 * Duas delas só existem por causa da venda SEM INTERNET, e as duas protegem
 * dinheiro: uma impede cobrar o cliente duas vezes, a outra impede a venda
 * cair no fechamento do dia errado.
 */

/** O troco: só no dinheiro, e só se o que veio cobre a conta. */
function troco(forma: string, totalCents: number, recebidoCents?: number) {
  if (forma !== 'CASH' || !recebidoCents) return { ok: true, changeCents: 0 };
  if (recebidoCents < totalCents) return { ok: false, changeCents: 0 };
  return { ok: true, changeCents: recebidoCents - totalCents };
}

/** Aceita a hora informada pelo aparelho? (venda offline chega atrasada) */
function horaDaVenda(agora: Date, informada?: string): Date {
  if (!informada) return agora;
  const quando = new Date(informada);
  const atrasoMs = agora.getTime() - quando.getTime();
  if (atrasoMs > 0 && atrasoMs < 24 * 60 * 60 * 1000) return quando;
  return agora;
}

const AGORA = new Date('2026-07-22T19:00:00-03:00');
const menos = (h: number) => new Date(AGORA.getTime() - h * 3600_000).toISOString();

describe('Troco do balcão', () => {
  it('R$ 50 numa conta de R$ 43,70 dá R$ 6,30', () => {
    expect(troco('CASH', 4370, 5000)).toEqual({ ok: true, changeCents: 630 });
  });

  it('valor exato não dá troco', () => {
    expect(troco('CASH', 4370, 4370)).toEqual({ ok: true, changeCents: 0 });
  });

  it('recebido menor que o total é recusado', () => {
    expect(troco('CASH', 4370, 100).ok).toBe(false);
  });

  it('no cartão não se calcula troco, mesmo se mandarem valor', () => {
    expect(troco('CARD', 4370, 5000)).toEqual({ ok: true, changeCents: 0 });
  });

  it('dinheiro sem informar quanto veio: passa, sem troco', () => {
    expect(troco('CASH', 4370, undefined)).toEqual({ ok: true, changeCents: 0 });
  });
});

describe('Hora da venda que ficou na fila (offline)', () => {
  it('sem hora informada, vale agora', () => {
    expect(horaDaVenda(AGORA)).toEqual(AGORA);
  });

  it('venda de 2h atrás mantém a hora do balcão — senão a gaveta não bate', () => {
    expect(horaDaVenda(AGORA, menos(2)).toISOString()).toBe(menos(2));
  });

  it('venda de 30h atrás é ignorada: relógio do aparelho está errado', () => {
    expect(horaDaVenda(AGORA, menos(30))).toEqual(AGORA);
  });

  it('hora no futuro é ignorada', () => {
    expect(horaDaVenda(AGORA, menos(-1))).toEqual(AGORA);
  });
});

describe('Fila offline: o que fazer com cada resposta do servidor', () => {
  /** A decisão do aparelho ao tentar subir uma venda guardada. */
  function decidir(status: number | 'sem-rede') {
    if (status === 'sem-rede') return 'tentar-depois';
    if (status < 300) return 'tirar-da-fila';
    if (status >= 400 && status < 500) return 'marcar-erro-e-seguir';
    return 'tentar-depois';
  }

  it('deu certo: sai da fila', () => {
    expect(decidir(201)).toBe('tirar-da-fila');
  });

  it('sem rede ainda: espera a próxima chance', () => {
    expect(decidir('sem-rede')).toBe('tentar-depois');
  });

  it('servidor fora do ar (500): espera — a venda continua valendo', () => {
    expect(decidir(500)).toBe('tentar-depois');
  });

  it('recusa definitiva (400): avisa o gerente e não trava a fila', () => {
    // Item apagado, marca pausada... insistir seria travar TODAS as vendas
    // seguintes atrás de uma que nunca vai passar.
    expect(decidir(400)).toBe('marcar-erro-e-seguir');
  });
});
