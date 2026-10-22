// Envia as mensagens agendadas vencidas. Roda dentro da aba do WhatsApp (precisa dela aberta).
import { alterar, ler, novoId, proximaData, type Agendamento } from '../shared/dados';
import { enviarResposta, enviarTextoComVariaveis } from './envio';
import { emitirWebhook } from '../shared/webhook';
import { wa } from './wa';

const INTERVALO = 20_000;
/** Agendamento com mais atraso que isso (PC desligado, aba fechada) não é enviado sozinho: fica como falha para a pessoa decidir. */
const ATRASO_MAXIMO = 6 * 3600_000;

async function marcar(id: string, p: Partial<Agendamento>) {
  await alterar('agendamentos', (lista) => lista.map((a) => (a.id === id ? { ...a, ...p } : a)));
}

/** Agendamento que repete: cria a próxima ocorrência. */
async function agendarProxima(a: Agendamento) {
  const quando = proximaData(a.quando, a.recorrencia);
  if (!quando) return;
  await alterar('agendamentos', (lista) => {
    lista.push({ ...a, id: novoId(), quando, status: 'pendente', erro: undefined, enviadoEm: undefined });
  });
}

async function rodada(avisar: (t: string, erro?: boolean) => void) {
  const agora = Date.now();
  const todos = await ler('agendamentos');
  // envio interrompido (aba recarregada no meio): não reenvia sozinho, pode ter saído
  for (const a of todos)
    if (a.status === 'enviando' && agora - a.quando > 10 * 60_000) await marcar(a.id, { status: 'falhou', erro: 'Envio interrompido. Confira na conversa se a mensagem saiu.' });
  const vencidos = todos.filter((a) => a.status === 'pendente' && a.quando <= agora);
  for (const a of vencidos) {
    if (agora - a.quando > ATRASO_MAXIMO) {
      await marcar(a.id, { status: 'falhou', erro: 'Não enviado: o WhatsApp estava fechado no horário.' });
      await agendarProxima(a);
      continue;
    }
    // trava antes de enviar, para não duplicar se houver duas abas
    let meu = false;
    await alterar('agendamentos', (lista) =>
      lista.map((x) => {
        if (x.id === a.id && x.status === 'pendente') {
          meu = true;
          return { ...x, status: 'enviando' as const };
        }
        return x;
      }),
    );
    if (!meu) continue;
    try {
      const contato = (await ler('contatos'))[a.chatId];
      const destino = { ...(contato ?? {}), id: a.chatId, nome: contato?.nome || a.nomeContato };
      const resposta = a.respostaId ? (await ler('respostas')).find((r) => r.id === a.respostaId) : undefined;
      if (resposta) await enviarResposta(destino, resposta);
      else await enviarTextoComVariaveis(destino, a.texto);
      await marcar(a.id, { status: 'enviado', enviadoEm: Date.now() });
      emitirWebhook('agendamento_enviado', { chatId: a.chatId, nome: a.nomeContato, texto: a.texto, respostaId: a.respostaId ?? null, agendadoPara: new Date(a.quando).toISOString() });
      avisar(`Mensagem agendada enviada para ${a.nomeContato || 'contato'}`);
    } catch (e) {
      await marcar(a.id, { status: 'falhou', erro: (e as Error).message });
      avisar(`Agendamento falhou: ${(e as Error).message}`, true);
    }
    await agendarProxima(a);
  }
}

/** Status programado: posta no status do próprio WhatsApp no horário. */
async function rodadaStatus(avisar: (t: string, erro?: boolean) => void) {
  const agora = Date.now();
  const vencidos = (await ler('statusProgramados')).filter((s) => s.status === 'pendente' && s.quando <= agora);
  for (const s of vencidos) {
    const marcarS = (p: Partial<typeof s>) => alterar('statusProgramados', (l) => l.map((x) => (x.id === s.id ? { ...x, ...p } : x)));
    const repetir = async () => {
      if (!s.repetir24h) return;
      let quando = s.quando + 86400_000;
      while (quando <= agora) quando += 86400_000;
      await alterar('statusProgramados', (l) => {
        l.push({ ...s, id: novoId(), quando, status: 'pendente', erro: undefined, postadoEm: undefined });
      });
    };
    if (agora - s.quando > ATRASO_MAXIMO) {
      await marcarS({ status: 'falhou', erro: 'Não postado: o WhatsApp estava fechado no horário.' });
      await repetir();
      continue;
    }
    try {
      await wa('postarStatus', s.tipo, s.tipo === 'texto' ? s.texto : s.arquivo ?? '', { legenda: s.texto || undefined, corFundo: s.corFundo });
      await marcarS({ status: 'postado', postadoEm: Date.now() });
      avisar('Status postado');
    } catch (e) {
      await marcarS({ status: 'falhou', erro: (e as Error).message });
      avisar(`Status não postado: ${(e as Error).message}`, true);
    }
    await repetir();
  }
}

export function iniciarAgendador(avisar: (t: string, erro?: boolean) => void) {
  let ocupado = false;
  const tique = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await rodada(avisar);
      await rodadaStatus(avisar);
    } finally {
      ocupado = false;
    }
  };
  tique();
  const t = setInterval(tique, INTERVALO);
  return () => clearInterval(t);
}
