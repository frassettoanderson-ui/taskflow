/**
 * DATAS — a armadilha mais cara deste projeto.
 *
 * `new Date('2026-07-22')` NÃO é 22 de julho aqui. O JavaScript lê essa forma
 * como meia-noite em UTC, que no Brasil (-03) é 21h do dia 21. Quem usa isso
 * para "o dia de hoje" acaba procurando o dia anterior — e o relatório sai
 * errado sem ninguém perceber.
 *
 * Estas funções montam a data no fuso LOCAL do servidor (que roda em
 * America/Sao_Paulo, definido no docker-compose).
 */

/** "2026-07-22" -> 22/07/2026 às 00:00:00 no horário local. */
export function inicioDoDia(texto?: string, padrao?: Date): Date {
  if (!texto) {
    const d = padrao ? new Date(padrao) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const [ano, mes, dia] = texto.slice(0, 10).split('-').map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1, 0, 0, 0, 0);
}

/** "2026-07-22" -> 22/07/2026 às 23:59:59 no horário local. */
export function fimDoDia(texto?: string, padrao?: Date): Date {
  if (!texto) {
    const d = padrao ? new Date(padrao) : new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  const [ano, mes, dia] = texto.slice(0, 10).split('-').map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1, 23, 59, 59, 999);
}

/** O primeiro dia do mês corrente, às 00:00 local. */
export function inicioDoMes(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Data no formato "2026-07-22", no fuso local (nunca use toISOString para isto). */
export function paraTextoLocal(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
