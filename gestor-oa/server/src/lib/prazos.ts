import {
  addDays,
  subDays,
  lastDayOfMonth,
  format,
  isWeekend,
  getDay,
} from 'date-fns';
import type { RegraPrazo } from '@gestoroa/shared';

// Conjunto de feriados no formato 'yyyy-MM-dd' para lookup O(1).
export type FeriadosSet = Set<string>;

function chave(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

// Um dia e' util se nao for fim de semana (sabado pode contar, conforme config)
// e nao for feriado.
export function ehDiaUtil(
  d: Date,
  feriados: FeriadosSet,
  sabadoEhUtil: boolean,
): boolean {
  const dow = getDay(d); // 0=dom, 6=sab
  if (dow === 0) return false; // domingo nunca e' util
  if (dow === 6 && !sabadoEhUtil) return false; // sabado depende da config
  if (feriados.has(chave(d))) return false;
  return true;
}

// Proximo dia util (inclusive) avancando.
export function proximoDiaUtil(
  d: Date,
  feriados: FeriadosSet,
  sabadoEhUtil: boolean,
): Date {
  let cur = d;
  while (!ehDiaUtil(cur, feriados, sabadoEhUtil)) cur = addDays(cur, 1);
  return cur;
}

// Dia util anterior (inclusive) retrocedendo.
export function diaUtilAnterior(
  d: Date,
  feriados: FeriadosSet,
  sabadoEhUtil: boolean,
): Date {
  let cur = d;
  while (!ehDiaUtil(cur, feriados, sabadoEhUtil)) cur = subDays(cur, 1);
  return cur;
}

// N-esimo dia util do mes (1-based).
export function nthDiaUtil(
  ano: number,
  mes0: number, // 0-11
  n: number,
  feriados: FeriadosSet,
  sabadoEhUtil: boolean,
): Date {
  let cur = new Date(ano, mes0, 1);
  let contador = 0;
  // limite de seguranca
  for (let i = 0; i < 60; i++) {
    if (ehDiaUtil(cur, feriados, sabadoEhUtil)) {
      contador++;
      if (contador === n) return cur;
    }
    cur = addDays(cur, 1);
  }
  return cur;
}

// Subtrai N dias uteis de uma data.
export function subtrairDiasUteis(
  d: Date,
  n: number,
  feriados: FeriadosSet,
  sabadoEhUtil: boolean,
): Date {
  let cur = d;
  let restantes = n;
  while (restantes > 0) {
    cur = subDays(cur, 1);
    if (ehDiaUtil(cur, feriados, sabadoEhUtil)) restantes--;
  }
  return cur;
}

export interface PrazosCalculados {
  prazoLegal: Date;
  prazoTecnico: Date;
}

// Calcula prazoLegal e prazoTecnico de uma competencia (mes/ano de referencia).
// O "dia" da regra e' aplicado sobre o mes de VENCIMENTO, que geralmente e' o
// mes seguinte ao da competencia (ex.: DAS de jan/2026 vence em fev/2026).
export function calcularPrazos(
  regra: RegraPrazo,
  competenciaAno: number,
  competenciaMes0: number, // 0-11 (mes de referencia)
  feriados: FeriadosSet,
  sabadoPadraoEscritorio: boolean,
  mesesAteVencimento = 1,
): PrazosCalculados {
  const sabadoEhUtil = regra.sabadoEhUtil ?? sabadoPadraoEscritorio;

  // mes de vencimento
  const base = new Date(competenciaAno, competenciaMes0 + mesesAteVencimento, 1);
  const ano = base.getFullYear();
  const mes0 = base.getMonth();

  let legal: Date;
  if (regra.tipoDia === 'DIA_UTIL') {
    legal = nthDiaUtil(ano, mes0, Math.max(1, regra.dia), feriados, sabadoEhUtil);
  } else {
    // DIA_FIXO - limita ao ultimo dia do mes
    const ultimo = lastDayOfMonth(new Date(ano, mes0, 1)).getDate();
    const dia = Math.min(regra.dia, ultimo);
    legal = new Date(ano, mes0, dia);
    // aplica regra de dia nao-util
    if (!ehDiaUtil(legal, feriados, sabadoEhUtil)) {
      if (regra.regraNaoUtil === 'ANTECIPA') {
        legal = diaUtilAnterior(legal, feriados, sabadoEhUtil);
      } else if (regra.regraNaoUtil === 'POSTERGA') {
        legal = proximoDiaUtil(legal, feriados, sabadoEhUtil);
      }
      // MANTEM: nao altera
    }
  }

  // prazo tecnico = legal - diasAntes
  let tecnico = legal;
  const diasAntes = regra.diasAntesTecnico ?? 0;
  if (diasAntes > 0) {
    tecnico =
      regra.tipoDiasAntes === 'UTEIS'
        ? subtrairDiasUteis(legal, diasAntes, feriados, sabadoEhUtil)
        : subDays(legal, diasAntes);
  }

  return { prazoLegal: legal, prazoTecnico: tecnico };
}

// Helper: monta o Set de feriados a partir de uma lista de datas.
export function montarFeriados(datas: Date[]): FeriadosSet {
  return new Set(datas.map((d) => chave(d)));
}
