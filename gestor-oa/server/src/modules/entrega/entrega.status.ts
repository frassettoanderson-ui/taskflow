import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { env } from '../../env.js';

export type StatusEntrega =
  | 'PENDENTE'
  | 'PENDENTE_ANTECIPADO'
  | 'EM_ATRASO_TECNICO'
  | 'EM_ATRASO_LEGAL'
  | 'JUSTIFICADA'
  | 'ENTREGUE'
  | 'ENTREGUE_JUSTIFICADA'
  | 'DISPENSADA';

// Status base = persistido apos baixa/dispensa; os pendentes sao derivados.
const STATUS_FINAIS: StatusEntrega[] = ['ENTREGUE', 'ENTREGUE_JUSTIFICADA', 'DISPENSADA'];

export function ehStatusFinal(s: StatusEntrega): boolean {
  return STATUS_FINAIS.includes(s);
}

// Entregue = baixada (ENTREGUE ou o legado ENTREGUE_JUSTIFICADA).
export function ehEntregue(s: StatusEntrega): boolean {
  return s === 'ENTREGUE' || s === 'ENTREGUE_JUSTIFICADA';
}

// Entregue COM ATRASO? Determinado pela DATA (dataEntrega > prazoLegal). O status
// legado ENTREGUE_JUSTIFICADA ja significa atraso. Novas baixas usam ENTREGUE +
// dataEntrega, e o atraso passa a vir da comparacao de datas.
export function entregueComAtraso(s: StatusEntrega, dataEntrega: Date | null, prazoLegal: Date): boolean {
  if (!ehEntregue(s)) return false;
  if (s === 'ENTREGUE_JUSTIFICADA') return true;
  if (!dataEntrega) return false;
  return startOfDay(dataEntrega) > startOfDay(prazoLegal);
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

// Status normalizado para INDICADORES/relatorios. Mantem a logica existente
// (que entende ENTREGUE_JUSTIFICADA como "entregue atrasada/com multa") funcionando
// apos a mudanca: agora o atraso na entrega vem da DATA, e a pendencia JUSTIFICADA
// conta como atrasada (EM_ATRASO_LEGAL).
export function statusParaIndicador(
  statusBase: StatusEntrega,
  dataEntrega: Date | null,
  prazoTecnico: Date,
  prazoLegal: Date,
  hoje: Date = new Date(),
  diasAntecipado = 7,
): StatusEntrega {
  if (ehEntregue(statusBase)) {
    return entregueComAtraso(statusBase, dataEntrega, prazoLegal) ? 'ENTREGUE_JUSTIFICADA' : 'ENTREGUE';
  }
  if (statusBase === 'DISPENSADA') return 'DISPENSADA';
  if (statusBase === 'JUSTIFICADA') return 'EM_ATRASO_LEGAL'; // pendencia atrasada justificada
  return computarStatusPendente(prazoTecnico, prazoLegal, hoje, diasAntecipado);
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
  // JUSTIFICADA e' uma pendencia atrasada justificada manualmente: mantem ate ser entregue/dispensada.
  if (statusBase === 'JUSTIFICADA') return 'JUSTIFICADA';
  return computarStatusPendente(prazoTecnico, prazoLegal, hoje, diasAntecipado);
}
