import { CustomerSegment } from '@prisma/client';
import { filtroDoSegmento } from './crm.service';
import { limparTelefone } from './loyalty.service';

/** A conta do cashback: X% sobre o que o cliente realmente pagou de comida. */
function cashbackDe(subtotal: number, desconto: number, cashbackUsado: number, bps: number) {
  const base = Math.max(0, subtotal - desconto - cashbackUsado);
  return Math.round((base * bps) / 10000);
}

/** O teto de uso do cashback num pedido. */
function tetoDeUso(saldo: number, subtotal: number, maxRedeemBps: number) {
  return Math.max(0, Math.min(saldo, Math.floor((subtotal * maxRedeemBps) / 10000)));
}

/** A conta do NPS: %promotores − %detratores. */
function calcularNps(notas: number[]) {
  if (notas.length === 0) return null;
  const promotores = notas.filter((n) => n >= 9).length;
  const detratores = notas.filter((n) => n <= 6).length;
  return Math.round(((promotores - detratores) / notas.length) * 100);
}

describe('Cashback', () => {
  it('5% de um pedido de R$ 100 dá R$ 5', () => {
    expect(cashbackDe(10000, 0, 0, 500)).toBe(500);
  });

  it('o cupom reduz a base do cashback', () => {
    // R$ 100 com R$ 20 de desconto -> 5% de R$ 80
    expect(cashbackDe(10000, 2000, 0, 500)).toBe(400);
  });

  it('cashback usado também reduz a base (não se ganha em cima do que não pagou)', () => {
    expect(cashbackDe(10000, 0, 3000, 500)).toBe(350);
  });

  it('nunca fica negativo, mesmo com desconto maior que o pedido', () => {
    expect(cashbackDe(5000, 9000, 0, 500)).toBe(0);
  });

  it('arredonda para o centavo mais próximo', () => {
    // 5% de R$ 33,33 = R$ 1,6665 -> R$ 1,67
    expect(cashbackDe(3333, 0, 0, 500)).toBe(167);
  });
});

describe('Teto de uso do cashback', () => {
  it('não deixa usar mais do que o saldo', () => {
    expect(tetoDeUso(500, 10000, 5000)).toBe(500);
  });

  it('não deixa pagar mais do que a metade do pedido (teto de 50%)', () => {
    expect(tetoDeUso(9999, 10000, 5000)).toBe(5000);
  });

  it('teto configurável: 30% em vez de 50%', () => {
    expect(tetoDeUso(9999, 10000, 3000)).toBe(3000);
  });

  it('sem saldo, não usa nada', () => {
    expect(tetoDeUso(0, 10000, 5000)).toBe(0);
  });
});

describe('Segmentos de clientes', () => {
  it('"ainda não pediram" é quem tem zero pedidos', () => {
    expect(filtroDoSegmento(CustomerSegment.FIRST_ORDER)).toEqual({ ordersCount: 0 });
  });

  it('"recorrentes" são 3 pedidos ou mais', () => {
    expect(filtroDoSegmento(CustomerSegment.RECURRING)).toEqual({ ordersCount: { gte: 3 } });
  });

  it('"inativos" precisa ter pedido antes E estar sumido', () => {
    const agora = new Date('2026-07-22T12:00:00Z');
    const f: any = filtroDoSegmento(CustomerSegment.INACTIVE, 30, agora);

    expect(f.ordersCount).toEqual({ gt: 0 });
    // o corte é 30 dias antes
    expect(f.lastOrderAt.lt.toISOString().slice(0, 10)).toBe('2026-06-22');
  });

  it('"todos" não filtra nada', () => {
    expect(filtroDoSegmento(CustomerSegment.ALL)).toEqual({});
  });
});

describe('Telefone', () => {
  it('guarda só os dígitos, venha como vier', () => {
    expect(limparTelefone('(48) 99123-4567')).toBe('48991234567');
    expect(limparTelefone('48 99123 4567')).toBe('48991234567');
    expect(limparTelefone('+55 48 99123-4567')).toBe('5548991234567');
  });

  it('aguenta vazio sem quebrar', () => {
    expect(limparTelefone('')).toBe('');
  });
});

describe('NPS', () => {
  it('todo mundo dando 10 dá NPS 100', () => {
    expect(calcularNps([10, 10, 9])).toBe(100);
  });

  it('todo mundo dando nota baixa dá NPS -100', () => {
    expect(calcularNps([0, 3, 6])).toBe(-100);
  });

  it('nota 7 e 8 são neutras: não somam nem subtraem', () => {
    expect(calcularNps([7, 8])).toBe(0);
  });

  it('metade promotor, metade detrator dá zero', () => {
    expect(calcularNps([10, 10, 2, 3])).toBe(0);
  });

  it('sem respostas, não há NPS', () => {
    expect(calcularNps([])).toBeNull();
  });
});
