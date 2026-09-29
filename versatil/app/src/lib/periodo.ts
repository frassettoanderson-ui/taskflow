// Datas no fuso de Brasília (a VPS pode estar em UTC): nunca usar toISOString() para "hoje".
const OFFSET = 3 * 3600_000;

export function mesAtualBRT() {
  const d = new Date(Date.now() - OFFSET);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Intervalo [início, fim) de um mês "AAAA-MM" em horário de Brasília. */
export function intervaloMes(mes: string) {
  const [a, m] = (/^\d{4}-\d{2}$/.test(mes) ? mes : mesAtualBRT()).split("-").map(Number);
  const inicio = new Date(Date.UTC(a, m - 1, 1) + OFFSET);
  const fim = new Date(Date.UTC(a, m, 1) + OFFSET);
  return { inicio, fim };
}

export function inicioDoDiaBRT(dias = 0) {
  const d = new Date(Date.now() - OFFSET);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dias) + OFFSET);
}

export function deslocarMes(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const nomeMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
};

export const diaBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
