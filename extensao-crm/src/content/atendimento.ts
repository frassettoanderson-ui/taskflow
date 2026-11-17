// Atendimento automático: só responde quem chamou primeiro.
// 1) saudação (primeiro contato ou cliente que volta), 2) IA respondendo, 3) para sozinha quando alguém da equipe escreve.
// Roda na aba do WhatsApp Web: se a aba fechar, ninguém responde.
import { alterar, assinar, ler, PALAVRAS_SAIR, type Assinatura, type ConfigAtendimento, type EstadoAtendimento } from '../shared/dados';
import { CHAMAR_ATENDENTE, SEM_RESPOSTA } from '../shared/ia';
import type { MsgResumo } from '../shared/protocolo';
import { enviarPassos, type Destino } from './envio';
import { pedirIA } from './iaCliente';
import { aoEvento, wa } from './wa';

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const agoraSeg = () => Date.now() / 1000;

/** Mensagens mais velhas que isso (sincronizadas quando o WhatsApp abre) não disparam nada. */
const IDADE_MAX_SEG = 15 * 60;

/** ids das mensagens que o próprio atendimento mandou */
const doRobo = new Set<string>();
/** envio do robô em andamento por conversa */
const enviando = new Map<string, Promise<unknown>>();
/** mensagens picadas do cliente: espera um pouco e responde tudo junto */
const lotes = new Map<string, { primeira: MsgResumo; timer: number }>();
/** uma conversa por vez é tratada (fila por chat) */
const filas = new Map<string, Promise<void>>();

let avisar: (texto: string, erro?: boolean) => void = () => {};

export function conversaIndividual(chatId: string) {
  return !!chatId && !chatId.endsWith('@g.us') && !chatId.endsWith('@broadcast') && !chatId.endsWith('@newsletter') && chatId !== 'status@broadcast';
}

// ---------- estado (gravações em fila para não se atropelarem) ----------

let gravacao: Promise<unknown> = Promise.resolve();

export function mudarEstado(chatId: string, fn: (e: EstadoAtendimento) => void) {
  const p = gravacao.then(() =>
    alterar('atendimentoChats', (todos) => {
      const e: EstadoAtendimento = todos[chatId] ?? { seguidas: 0, visto: Date.now() };
      fn(e);
      todos[chatId] = e;
    }),
  );
  gravacao = p.catch(() => {});
  return p;
}

/** Anota o que o atendimento decidiu (aparece em Configurações > Atendimento automático > Registro). */
function registrar(chatId: string, nome: string, texto: string, erro?: boolean) {
  console.info('[CRM atendimento]', chatId, texto);
  gravacao = gravacao
    .then(() => alterar('registroAtendimento', (l) => [{ em: Date.now(), chatId, nome, texto, erro }, ...l].slice(0, 40)))
    .catch(() => {});
}

function notificar(chatId: string, titulo: string, texto: string) {
  avisar(`${titulo}: ${texto}`);
  chrome.runtime.sendMessage({ tipo: 'notificar-atendimento', chatId, titulo, texto }).catch(() => {});
}

async function passarParaHumano(chatId: string, nome: string, motivo: NonNullable<EstadoAtendimento['motivoHumano']>, texto: string) {
  await mudarEstado(chatId, (e) => {
    e.humanoEm = Date.now();
    e.motivoHumano = motivo;
    e.seguidas = 0;
  });
  notificar(chatId, `Atender ${nome || 'cliente'}`, texto);
}

// ---------- mensagens ----------

const ROTULO: Record<string, string> = {
  image: '[imagem]',
  video: '[vídeo]',
  ptt: '[áudio]',
  audio: '[áudio]',
  document: '[arquivo]',
  sticker: '[figurinha]',
  location: '[localização]',
  vcard: '[contato]',
  multi_vcard: '[contatos]',
};

function conteudo(m: MsgResumo) {
  const r = m.tipo === 'chat' ? '' : (ROTULO[m.tipo] ?? '[mensagem]');
  return [r, m.texto.trim()].filter(Boolean).join(' ');
}

function pediuParaSair(texto: string) {
  const t = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim();
  return PALAVRAS_SAIR.includes(t);
}

function assinaturaDoRobo(cfg: ConfigAtendimento, base: Assinatura): Assinatura {
  return { ...base, ativa: !!cfg.nomeAssinatura.trim(), nome: cfg.nomeAssinatura.trim() };
}

/** Envia marcando cada mensagem como do robô. */
function enviarComoRobo(chatId: string, tarefa: () => Promise<void>) {
  const p = tarefa();
  enviando.set(chatId, p);
  return p.finally(() => {
    if (enviando.get(chatId) === p) enviando.delete(chatId);
  });
}

// ---------- quem é: equipe ou robô ----------

async function mensagemMinha(m: MsgResumo) {
  if (!conversaIndividual(m.chatId) || m.sistema || agoraSeg() - m.t > IDADE_MAX_SEG) return;
  // o evento chega antes do envio terminar: espera o robô acabar para saber se foi ele
  await (enviando.get(m.chatId) ?? Promise.resolve()).catch(() => {});
  await espera(1200);
  if (doRobo.has(m.id)) return;
  const cfg = await ler('atendimento');
  if (!cfg.saudacaoAtiva && !cfg.iaAtiva) return;
  const estados = await ler('atendimentoChats');
  const e = estados[m.chatId];
  if (e?.humanoEm) return;
  // alguém da equipe escreveu: a IA sai desta conversa
  await mudarEstado(m.chatId, (x) => {
    x.humanoEm = Date.now();
    x.motivoHumano = 'equipe';
    x.seguidas = 0;
  });
  // cancela uma resposta que estava esperando o cliente terminar de digitar
  const lote = lotes.get(m.chatId);
  if (lote) {
    clearTimeout(lote.timer);
    lotes.delete(m.chatId);
  }
}

// ---------- mensagem do cliente ----------

async function mensagemDoCliente(m: MsgResumo) {
  if (!conversaIndividual(m.chatId) || m.sistema) return;
  const nome = m.chatId.split('@')[0];
  if (agoraSeg() - m.t > IDADE_MAX_SEG) return registrar(m.chatId, nome, 'Mensagem antiga (mais de 15 min): ignorada');
  const cfg = await ler('atendimento');
  if (!cfg.saudacaoAtiva && !cfg.iaAtiva) return registrar(m.chatId, nome, 'Recebida, mas saudação e IA estão desligadas');
  if (!lotes.has(m.chatId)) registrar(m.chatId, nome, `Recebida: "${conteudo(m).slice(0, 60)}". Respondendo em alguns segundos`);
  const anterior = lotes.get(m.chatId);
  if (anterior) clearTimeout(anterior.timer);
  const min = Math.max(1, cfg.esperaMin);
  const max = Math.max(min, cfg.esperaMax);
  const seg = min + Math.random() * (max - min);
  const primeira = anterior?.primeira ?? m;
  const timer = window.setTimeout(() => {
    lotes.delete(m.chatId);
    const fila = (filas.get(m.chatId) ?? Promise.resolve()).then(() => tratar(m.chatId, primeira)).catch((err) => {
      avisar(`Atendimento automático: ${(err as Error).message}`, true);
      registrar(m.chatId, nome, `Erro: ${(err as Error).message}`, true);
    });
    filas.set(m.chatId, fila);
  }, seg * 1000);
  lotes.set(m.chatId, { primeira, timer });
}

async function tratar(chatId: string, primeira: MsgResumo) {
  const [cfg, estados, contatos, config] = await Promise.all([ler('atendimento'), ler('atendimentoChats'), ler('contatos'), ler('config')]);
  if (!cfg.saudacaoAtiva && !cfg.iaAtiva) return;
  const st = estados[chatId];
  const nm = contatos[chatId]?.nome || chatId.split('@')[0];
  if (st?.saiu) return registrar(chatId, nm, 'Não respondeu: o cliente tinha pedido para sair');

  const [hist, info] = await Promise.all([wa('historico', chatId, 40), wa('infoChat', chatId)]);
  const doLote = hist.filter((x) => x.t >= primeira.t);
  // alguém da equipe já respondeu enquanto o robô esperava
  if (doLote.some((x) => x.deMim && !doRobo.has(x.id))) return registrar(chatId, nm, 'Não respondeu: alguém da equipe respondeu antes');
  const doCliente = doLote.filter((x) => !x.deMim);
  if (!doCliente.length) return registrar(chatId, nm, `Não achou a mensagem do cliente no histórico (${hist.length} mensagens lidas)`, true);

  const ultimoTexto = doCliente[doCliente.length - 1].texto;
  if (pediuParaSair(ultimoTexto)) {
    await mudarEstado(chatId, (e) => {
      e.saiu = true;
    });
    avisar(`${info.nome || info.numero} pediu para não receber mais mensagens automáticas`);
    return registrar(chatId, nm, 'Cliente pediu para sair: automático desligado para ele');
  }

  const anteriores = hist.filter((x) => x.t < primeira.t);
  const ultimaAntes = anteriores.length ? anteriores[anteriores.length - 1].t * 1000 : 0;
  const intervalo = Math.max(1, cfg.novaConversaHoras) * 3600_000;
  const novaConversa = primeira.t * 1000 - ultimaAntes > intervalo && !(st?.ultimaSaudacao && Date.now() - st.ultimaSaudacao < intervalo);
  const conhecido = anteriores.length > 0 || !!contatos[chatId] || !!st || info.salvo;

  const contato = contatos[chatId];
  const destino: Destino = { ...(contato ?? {}), id: chatId, nome: contato?.nome || info.nome, numero: contato?.numero || info.numero };
  const assinatura = assinaturaDoRobo(cfg, config.assinatura);

  let humano = !!st?.humanoEm;
  if (humano && novaConversa && cfg.voltaIA === 'novaConversa') humano = false;

  await mudarEstado(chatId, (e) => {
    if (!humano && e.humanoEm) {
      e.humanoEm = undefined;
      e.motivoHumano = undefined;
    }
    if (novaConversa) e.seguidas = 0;
  });

  // 1) saudação
  if (cfg.saudacaoAtiva && novaConversa) {
    const passos = conhecido ? cfg.retorno : cfg.primeiroContato;
    if (!passos.length) registrar(chatId, nm, `Conversa nova, mas a saudação de ${conhecido ? '"já conversou antes"' : '"primeiro contato"'} está vazia`);
    if (passos.length) {
      registrar(chatId, nm, `Mandando saudação de ${conhecido ? 'cliente que volta' : 'primeiro contato'}`);
      await enviarComoRobo(chatId, () => enviarPassos(destino, passos, assinatura, (id) => doRobo.add(id)));
      await mudarEstado(chatId, (e) => {
        e.ultimaSaudacao = Date.now();
      });
    }
  }

  // 2) IA
  if (!cfg.iaAtiva) {
    if (!(cfg.saudacaoAtiva && novaConversa)) registrar(chatId, nm, novaConversa ? 'IA desligada' : `IA desligada e não é conversa nova (última mensagem há menos de ${cfg.novaConversaHoras}h)`);
    return;
  }
  if (humano) return registrar(chatId, nm, 'IA não respondeu: conversa com a equipe (devolva pela ficha)');
  if (st?.iaDesligada) return registrar(chatId, nm, 'IA desligada nesta conversa');
  const seguidas = novaConversa ? 0 : (st?.seguidas ?? 0);
  if (seguidas >= Math.max(1, cfg.limiteSeguidas)) {
    await passarParaHumano(chatId, destino.nome ?? '', 'limite', `a IA já respondeu ${seguidas} vezes seguidas`);
    return;
  }

  const conversa = (await wa('historico', chatId, 30)).map((x) => `${x.deMim ? 'Empresa' : 'Cliente'}: ${conteudo(x)}`).join('\n');
  const nomeCliente = destino.nome ? `Nome do cliente: ${destino.nome}\n` : '';
  let resposta: string;
  try {
    resposta = (await pedirIA('atender', '', `${nomeCliente}${conhecido ? 'Cliente que já conversou com a empresa antes.' : 'Primeiro contato deste cliente.'}\n\nConversa:\n${conversa}`, cfg.instrucoes)).trim();
  } catch (err) {
    avisar(`A IA não respondeu ${destino.nome || destino.numero}: ${(err as Error).message}`, true);
    return registrar(chatId, nm, `Erro da IA: ${(err as Error).message}`, true);
  }

  // a equipe pode ter assumido enquanto a IA pensava
  const agora = (await ler('atendimentoChats'))[chatId];
  if (agora?.humanoEm || agora?.iaDesligada || !(await ler('atendimento')).iaAtiva) return registrar(chatId, nm, 'IA respondeu, mas a equipe assumiu (ou desligaram) antes de enviar');

  if (!resposta || resposta.includes(SEM_RESPOSTA)) return registrar(chatId, nm, 'A IA achou que a mensagem não precisava de resposta');
  const chamar = resposta.startsWith(CHAMAR_ATENDENTE) || resposta.includes(CHAMAR_ATENDENTE);
  const texto = resposta.split(CHAMAR_ATENDENTE).join('').trim();

  if (texto) {
    const final = assinar(texto, assinatura);
    await enviarComoRobo(chatId, async () => {
      await wa('simular', chatId, 'digitando', Math.min(10, Math.max(2, Math.round(final.length / 18))));
      const id = await wa('enviarTexto', chatId, final);
      if (id) doRobo.add(id);
    });
  }
  registrar(chatId, nm, chamar ? 'IA respondeu e chamou a equipe' : `IA respondeu: "${texto.slice(0, 60)}"`);
  if (chamar) {
    await passarParaHumano(chatId, destino.nome ?? '', 'ia', `a IA pediu ajuda: "${ultimoTexto.slice(0, 80)}"`);
    return;
  }
  await mudarEstado(chatId, (e) => {
    e.seguidas = seguidas + 1;
  });
}

export function iniciarAtendimento(aviso: (texto: string, erro?: boolean) => void) {
  avisar = aviso;
  console.info('[CRM atendimento] ligado, ouvindo mensagens');
  const desliga = aoEvento((e) => {
    if (e.tipo !== 'nova_msg') return;
    if (e.msg.deMim) mensagemMinha(e.msg).catch(() => {});
    else mensagemDoCliente(e.msg).catch(() => {});
  });
  return () => {
    desliga();
  };
}
