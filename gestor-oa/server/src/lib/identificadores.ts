import type { TipoIdentificador } from '@gestoroa/shared';

// Remove tudo que nao for digito.
export function soDigitos(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '');
}

// Validacao de CNPJ (digitos verificadores).
export function cnpjValido(valor: string): boolean {
  const c = soDigitos(valor);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    let soma = 0;
    let pos = base.length - 7;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c === c.slice(0, 12) + String(d1) + String(d2);
}

// Validacao de CPF (digitos verificadores).
export function cpfValido(valor: string): boolean {
  const c = soDigitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (qtd: number) => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += Number(c[i]) * (qtd + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

// Formatacao para exibicao.
export function formatarIdentificador(
  tipo: TipoIdentificador,
  valor: string,
): string {
  const c = soDigitos(valor);
  if (tipo === 'CNPJ' && c.length === 14) {
    return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (tipo === 'CPF' && c.length === 11) {
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return valor;
}

// Validacao basica por tipo (CNPJ/CPF checam DV; demais checam comprimento minimo).
export function identificadorValido(
  tipo: TipoIdentificador,
  valor: string,
): boolean {
  const c = soDigitos(valor);
  if (!c) return false;
  if (tipo === 'CNPJ') return cnpjValido(c);
  if (tipo === 'CPF') return cpfValido(c);
  return c.length >= 2; // IE/CEI/CAEPF: formatos variados por UF/orgao
}
