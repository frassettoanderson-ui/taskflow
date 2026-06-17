import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { env } from '../../env.js';

export type StatusEntrega =
  | 'PENDENTE'
  | 'PENDENTE_ANTECIPADO'
  | 'EM_ATRASO_TECNICO'
  | 'EM_ATRASO_LEGAL'
  | 'ENTREGUE'
  | 'ENTREGUE_JUSTIFICADA'
  | 'DISPENSADA';

// Status base = persistido apos baixa/dispensa; os pendentes sao derivados.
const STATUS_FINAIS: StatusEntrega[] = ['ENTREGUE', 'ENTREGUE_JUSTIFICADA', 'DISPENSADA'];

export function ehStatusFinal(s: StatusEntrega): boolean {
  return STATUS_FINAIS.includes(s);
}

// Calcula o status de exibicao de uma entrega pendente conforme a data atual.
// diasAntecipado: distancia (em dias) ao prazo tecnico abaixo da qual passa de
// PENDENTE_ANTECIPADO para PENDENTE.
export function computarStatusPendente(
  prazoTecnico: Date,
  prazoLegal: Date,
  hoje: Date = new Date(),
  diasAntecipado = 7,
): StatusEntrega {
  const hojeBrt = startOfDay(toZonedTime(hoje, env.tz));
  const tecnico = startOfDay(prazoTecnico);
  const legal = startOfDay(prazoLegal);

  if (hojeBrt > legal) return 'EM_ATRASO_LEGAL';
  if (hojeBrt > tecnico) return 'EM_ATRASO_TECNICO';
  // ainda dentro do prazo tecnico
  const diasAteTecnico = differenceInCalendarDays(tecnico, hojeBrt);
  if (diasAteTecnico > diasAntecipado) return 'PENDENTE_ANTECIPADO';
  return 'PENDENTE';
}

// Resolve o status efetivo: se ja' baixada/dispensada mantem; senao deriva.
export function statusEfetivo(
  statusBase: StatusEntrega,
  prazoTecnico: Date,
  prazoLegal: Date,
  hoje: Date = new Date(),
  diasAntecipado = 7,
): StatusEntrega {
  if (ehStatusFinal(statusBase)) return statusBase;
  return computarStatusPendente(prazoTecnico, prazoLegal, hoje, diasAntecipado);
}
