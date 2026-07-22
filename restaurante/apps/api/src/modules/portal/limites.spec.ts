/**
 * As regras de limite de plano e de inadimplência.
 *
 * Elas nasceram de duas decisões do fundador, e é bom que fiquem escritas aqui
 * em forma de teste — porque as duas são fáceis de inverter sem querer:
 *
 *   1. estourar o limite de PEDIDOS **nunca** bloqueia: cobra excedente;
 *   2. atraso de pagamento bloqueia **tudo**, mas só a partir do 15º dia.
 */

const DIAS_ATE_CORTAR = 15;
const AVISA_A_PARTIR_DE = 0.8;

/** Quanto de excedente há, e quanto isso custa. */
function excedente(pedidos: number, limite: number, precoCents: number) {
  const passou = limite > 0 ? Math.max(0, pedidos - limite) : 0;
  return { pedidos: passou, cents: passou * precoCents };
}

/** Criar mais uma marca é permitido? */
function podeCriarMarca(marcas: number, limite: number) {
  return limite === 0 || marcas < limite;
}

/** O atraso já corta a conta? */
function bloqueado(diasAtrasado: number) {
  return diasAtrasado >= DIAS_ATE_CORTAR;
}

describe('Limite de pedidos: cobra, nunca bloqueia', () => {
  it('dentro do limite não há excedente', () => {
    expect(excedente(250, 300, 30)).toEqual({ pedidos: 0, cents: 0 });
  });

  it('10 pedidos além do limite a R$ 0,30 dão R$ 3,00', () => {
    expect(excedente(310, 300, 30)).toEqual({ pedidos: 10, cents: 300 });
  });

  it('limite 0 quer dizer ilimitado — nunca gera excedente', () => {
    expect(excedente(99999, 0, 30)).toEqual({ pedidos: 0, cents: 0 });
  });

  it('excedente de graça (preço 0) conta os pedidos mas não cobra', () => {
    expect(excedente(310, 300, 0)).toEqual({ pedidos: 10, cents: 0 });
  });

  it('o aviso começa em 80% do limite, antes de estourar', () => {
    const avisa = (usados: number, limite: number) => usados >= limite * AVISA_A_PARTIR_DE;
    expect(avisa(239, 300)).toBe(false);
    expect(avisa(240, 300)).toBe(true);
  });
});

describe('Limite de marcas: este sim bloqueia', () => {
  it('plano de 1 marca, com 0 criadas: pode', () => {
    expect(podeCriarMarca(0, 1)).toBe(true);
  });

  it('plano de 1 marca, com 1 criada: não pode', () => {
    expect(podeCriarMarca(1, 1)).toBe(false);
  });

  it('plano ilimitado: sempre pode', () => {
    expect(podeCriarMarca(500, 0)).toBe(true);
  });
});

describe('Corte por falta de pagamento (15 dias)', () => {
  it('no dia do vencimento não corta', () => {
    expect(bloqueado(0)).toBe(false);
  });

  it('14 dias de atraso ainda não corta — só avisa', () => {
    expect(bloqueado(14)).toBe(false);
  });

  it('15 dias corta', () => {
    expect(bloqueado(15)).toBe(true);
  });

  it('30 dias segue cortado', () => {
    expect(bloqueado(30)).toBe(true);
  });
});

describe('O que continua aberto mesmo bloqueado', () => {
  const SEMPRE_LIBERADO = [
    '/api/auth',
    '/api/health',
    '/api/portal-admin/assinatura',
    '/api/portal-admin/planos',
    '/api/portal-admin/consumo',
  ];
  const liberado = (caminho: string) => SEMPRE_LIBERADO.some((c) => caminho.startsWith(c));

  it('login continua aberto — senão nem entrar para pagar ele consegue', () => {
    expect(liberado('/api/auth/login')).toBe(true);
  });

  it('a tela da assinatura continua aberta: é onde ele paga', () => {
    expect(liberado('/api/portal-admin/assinatura')).toBe(true);
  });

  it('o aviso que EXPLICA o bloqueio continua aberto', () => {
    // Sem isto o restaurante veria telas quebradas sem entender o motivo.
    expect(liberado('/api/portal-admin/consumo')).toBe(true);
  });

  it('o resto do painel é barrado', () => {
    expect(liberado('/api/orders/kds')).toBe(false);
    expect(liberado('/api/pdv/vendas')).toBe(false);
    expect(liberado('/api/admin/marcas')).toBe(false);
  });
});
