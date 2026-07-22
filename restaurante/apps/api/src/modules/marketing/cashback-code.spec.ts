import { createHash } from 'node:crypto';

/**
 * As regras do código de confirmação do cashback, testadas sem banco.
 *
 * O que estas provas defendem: até a Etapa 4, o telefone sozinho autorizava
 * gastar o saldo de alguém. Se alguma dessas regras cair, o buraco volta.
 */

function resumo(codigo: string) {
  return createHash('sha256').update(codigo).digest('hex');
}

function mascarar(phone: string) {
  return phone.length <= 4 ? phone : '•'.repeat(phone.length - 4) + phone.slice(-4);
}

/** A decisão de aceitar (ou não) um token no fechamento do pedido. */
function tokenVale(
  registro: {
    brandId: string;
    phone: string;
    confirmedAt: Date | null;
    tokenUsedAt: Date | null;
    expiresAt: Date;
  } | null,
  pedido: { brandId: string; phone: string },
  agora = new Date(),
) {
  if (!registro) return false;
  if (registro.brandId !== pedido.brandId) return false;
  if (registro.phone !== pedido.phone) return false;
  if (!registro.confirmedAt) return false;
  if (registro.tokenUsedAt) return false;
  return registro.expiresAt > agora;
}

const daquiA = (min: number) => new Date(Date.now() + min * 60_000);
const base = {
  brandId: 'marca-a',
  phone: '48999990000',
  confirmedAt: new Date(),
  tokenUsedAt: null as Date | null,
  expiresAt: daquiA(30),
};
const pedido = { brandId: 'marca-a', phone: '48999990000' };

describe('Código de confirmação do cashback', () => {
  it('o código não é guardado em texto — só o resumo', () => {
    const h = resumo('123456');
    expect(h).not.toBe('123456');
    expect(h).toHaveLength(64);
  });

  it('o mesmo código dá sempre o mesmo resumo (é assim que conferimos)', () => {
    expect(resumo('123456')).toBe(resumo('123456'));
  });

  it('um dígito diferente muda o resumo inteiro', () => {
    expect(resumo('123456')).not.toBe(resumo('123457'));
  });

  it('a máscara confirma o número sem entregar o telefone', () => {
    expect(mascarar('48999990000')).toBe('•••••••0000');
    expect(mascarar('48999990000')).not.toContain('4899999');
  });
});

describe('Quando o token autoriza o resgate', () => {
  it('token confirmado, no prazo e não usado: autoriza', () => {
    expect(tokenVale(base, pedido)).toBe(true);
  });

  it('sem token nenhum: recusa (era exatamente o buraco antigo)', () => {
    expect(tokenVale(null, pedido)).toBe(false);
  });

  it('token de OUTRO telefone: recusa', () => {
    expect(tokenVale({ ...base, phone: '48911112222' }, pedido)).toBe(false);
  });

  it('token de OUTRA marca: recusa — cada marca tem sua base', () => {
    expect(tokenVale({ ...base, brandId: 'marca-b' }, pedido)).toBe(false);
  });

  it('token já usado: recusa — um token, um pedido', () => {
    expect(tokenVale({ ...base, tokenUsedAt: new Date() }, pedido)).toBe(false);
  });

  it('token vencido: recusa', () => {
    expect(tokenVale({ ...base, expiresAt: daquiA(-1) }, pedido)).toBe(false);
  });

  it('código pedido mas nunca confirmado: recusa', () => {
    expect(tokenVale({ ...base, confirmedAt: null }, pedido)).toBe(false);
  });
});
