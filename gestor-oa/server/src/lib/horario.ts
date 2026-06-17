import { toZonedTime } from 'date-fns-tz';
import { env } from '../env.js';
import type { JanelaAcesso } from '@gestoroa/shared';

// Verifica se o momento atual (no fuso America/Sao_Paulo) esta' dentro de
// alguma janela de acesso permitida. Lista vazia = sempre permitido.
export function dentroDoHorario(
  janelas: JanelaAcesso[] | null | undefined,
  agora: Date = new Date(),
): boolean {
  if (!janelas || janelas.length === 0) return true;

  const zoned = toZonedTime(agora, env.tz);
  const diaSemana = zoned.getDay(); // 0=domingo
  const minutosAgora = zoned.getHours() * 60 + zoned.getMinutes();

  return janelas.some((j) => {
    if (j.diaSemana !== diaSemana) return false;
    const ini = parseHora(j.inicio);
    const fim = parseHora(j.fim);
    if (ini === null || fim === null) return false;
    return minutosAgora >= ini && minutosAgora <= fim;
  });
}

function parseHora(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
