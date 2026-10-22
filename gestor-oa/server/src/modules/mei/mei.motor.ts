// Regras do MEI (painel da Atuan, motor-mei.js) usadas pelo servidor.
// A mesma logica existe no front (obrigo/pages/mei/motor.ts) para os calculos de tela.
export const ATIVIDADES = ['comercio', 'servicos', 'ambos', 'transporte'];
export const SITUACOES_MEI = ['Ativo', 'Baixado', 'Desenquadrado', 'Inativo'];
export const SAL_MIN_PADRAO: Record<string, number> = { 2021: 1100, 2022: 1212, 2023: 1320, 2024: 1412, 2025: 1518, 2026: 1630 };
export const LIMITE_ANUAL = 81000;
export const CONTAS: Record<string, { sinal: 1 | -1; rotulo: string }> = {
  rec_vendas: { sinal: 1, rotulo: 'Venda de mercadorias/produtos' },
  rec_servicos: { sinal: 1, rotulo: 'Prestação de serviços' },
  rec_outras: { sinal: 1, rotulo: 'Outras receitas' },
  rec_fin: { sinal: 1, rotulo: 'Receitas financeiras' },
  ded_impostos: { sinal: -1, rotulo: 'Impostos sobre vendas (DAS/ICMS/ISS)' },
  ded_devol: { sinal: -1, rotulo: 'Devoluções e descontos' },
  cmv: { sinal: -1, rotulo: 'Custo das mercadorias/serviços (CMV/CSP)' },
  desp_pessoal: { sinal: -1, rotulo: 'Despesas com pessoal' },
  desp_admin: { sinal: -1, rotulo: 'Despesas administrativas' },
  desp_comercial: { sinal: -1, rotulo: 'Despesas comerciais' },
  desp_fin: { sinal: -1, rotulo: 'Despesas financeiras' },
  outras_desp: { sinal: -1, rotulo: 'Outras despesas' },
};
export const r2 = (x: number) => Math.round(x * 100) / 100;

export function salarioMinimo(ano: number, tabela: Record<string, number>) {
  const t = { ...SAL_MIN_PADRAO, ...tabela };
  if (Number(t[String(ano)])) return Number(t[String(ano)]);
  const anos = Object.keys(t).sort();
  return Number(t[anos[anos.length - 1]]) || 1630;
}
export function das(atividade: string, ano: number, tabela: Record<string, number>) {
  const sm = salarioMinimo(ano, tabela);
  const inss = r2(sm * (atividade === 'transporte' ? 0.12 : 0.05));
  const icms = ['comercio', 'ambos', 'transporte'].includes(atividade) ? 1 : 0;
  const iss = ['servicos', 'ambos'].includes(atividade) ? 5 : 0;
  return r2(inss + icms + iss);
}
export const comp = (d: Date) => d.toISOString().slice(0, 7);
export function vencimento(c: string) {
  const [a, m] = c.split('-').map(Number);
  const ano = m === 12 ? a + 1 : a; const mes = m === 12 ? 1 : m + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-20`;
}
export function ultimoDia(c: string) {
  const [a, m] = c.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0));
}
export const hojeISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
export const hojeData = () => new Date(`${hojeISO()}T00:00:00Z`);
