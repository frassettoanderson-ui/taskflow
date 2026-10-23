import { alterar, aplicarVariaveis, assinar, contatoVazio, ler, type Contato, type PassoFluxo, type RespostaRapida } from '../shared/dados';
import { emitirWebhook } from '../shared/webhook';
import { wa } from './wa';

/** Para quem vai: id do chat + o que se sabe do contato (para as variáveis). */
export type Destino = Partial<Contato> & { id: string };

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const MARCA_TODOS = /\{\{\s*mencionar_todos\s*\}\}/gi;

/** Texto final + menções. {{mencionar_todos}} vira "@numero @numero..." em grupos e some fora deles. */
async function prepararTexto(destino: Destino, texto: string) {
  let final = aplicarVariaveis(texto, destino);
  final = assinar(final, (await ler('config')).assinatura);
  let mencoes: string[] | undefined;
  if (MARCA_TODOS.test(final)) {
    MARCA_TODOS.lastIndex = 0;
    if (destino.id.endsWith('@g.us')) {
      const eu = await wa('eu');
      const ps = (await wa('participantes', destino.id)).filter((p) => p.id !== eu);
      mencoes = ps.map((p) => p.id);
      final = final.replace(MARCA_TODOS, ps.map((p) => `@${p.id.split('@')[0]}`).join(' '));
    } else {
      final = final.replace(MARCA_TODOS, '').trim();
    }
  }
  return { texto: final, mencoes };
}

type Envio = Pick<PassoFluxo, 'tipo' | 'texto' | 'arquivo' | 'nomeArquivo' | 'ptt' | 'simular' | 'simularSeg'>;

async function enviarUma(destino: Destino, r: Envio) {
  if (r.simular !== 'nenhuma' && r.simularSeg > 0) await wa('simular', destino.id, r.simular, r.simularSeg);
  const { texto, mencoes } = await prepararTexto(destino, r.texto);
  if (r.tipo === 'texto' || !r.arquivo) {
    if (texto) await wa('enviarTexto', destino.id, texto, mencoes);
    return;
  }
  await wa('enviarArquivo', destino.id, r.arquivo, {
    tipo: r.tipo,
    legenda: r.tipo === 'audio' ? undefined : texto || undefined,
    nomeArquivo: r.nomeArquivo,
    ptt: r.tipo === 'audio' ? r.ptt !== false : undefined,
  });
}

async function aplicarAcoes(destino: Destino, r: Pick<RespostaRapida, 'acoes'>) {
  return executarAcoes(destino, r.acoes);
}

export async function executarAcoes(destino: Destino, acoes: RespostaRapida['acoes']) {
  const { mover, arquivar, etiquetaWA } = acoes;
  if (mover) {
    await alterar('contatos', (todos) => {
      const c = todos[destino.id] ?? contatoVazio(destino.id, destino.nome ?? '', destino.numero ?? '');
      c.posicoes[mover.funilId] = mover.etapaId;
      c.atualizadoEm = Date.now();
      todos[destino.id] = c;
    });
  }
  if (etiquetaWA) await wa('etiquetarChat', [destino.id], [{ id: etiquetaWA, tipo: 'add' }]).catch(() => {});
  if (arquivar) await wa('arquivar', destino.id, true);
}

/** Envia uma resposta rápida (ou o script inteiro), aplica as ações e conta o uso. */
export async function enviarResposta(destino: Destino, r: RespostaRapida) {
  if (r.tipo === 'script') {
    const passos = r.passos ?? [];
    for (let i = 0; i < passos.length; i++) {
      if (i > 0 && passos[i].esperaSeg > 0) await espera(passos[i].esperaSeg * 1000);
      await enviarUma(destino, passos[i]);
    }
  } else {
    await enviarUma(destino, r as Envio);
  }
  await aplicarAcoes(destino, r);
  emitirWebhook('resposta_enviada', { chatId: destino.id, numero: destino.numero, nome: destino.nome, resposta: { id: r.id, titulo: r.titulo, atalho: r.atalho, tipo: r.tipo } });
  await alterar('respostas', (lista) => lista.map((x) => (x.id === r.id ? { ...x, usos: (x.usos ?? 0) + 1 } : x)));
}

/** Texto livre (agendamentos): variáveis e {{mencionar_todos}} valem igual. */
export async function enviarTextoComVariaveis(destino: Destino, texto: string) {
  const p = await prepararTexto(destino, texto);
  if (p.texto) await wa('enviarTexto', destino.id, p.texto, p.mencoes);
}

/** Coloca o texto no campo de digitação, sem enviar, para a pessoa revisar. */
export async function inserirResposta(destino: Destino, r: RespostaRapida) {
  const { texto } = await prepararTexto(destino, r.texto);
  await wa('escreverNoCampo', destino.id, texto);
  await alterar('respostas', (lista) => lista.map((x) => (x.id === r.id ? { ...x, usos: (x.usos ?? 0) + 1 } : x)));
}

/** Monta o destino a partir do chat + ficha salva. */
export function destinoDe(chat: { id: string; nome: string; numero: string }, contato?: Contato): Destino {
  return { ...(contato ?? {}), id: chat.id, nome: contato?.nome || chat.nome, numero: contato?.numero || chat.numero };
}
