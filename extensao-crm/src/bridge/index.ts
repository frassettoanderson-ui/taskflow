// Roda no mundo da página (world: MAIN), ao lado do wa-js.
// Só executa métodos da lista abaixo; nada de eval/código vindo de fora.
import { EVT, REQ, RES, type ChatResumo, type EtiquetaWA, type Evento, type Metodos, type MsgResumo, type Requisicao, type Resposta } from '../shared/protocolo';

declare const WPP: any;

type SemSrc<T> = T extends unknown ? Omit<T, 'src'> : never;
const emitir = (e: SemSrc<Evento>) => window.postMessage({ src: EVT, ...e }, location.origin);

function numeroDe(id: string) {
  return id.split('@')[0].split(':')[0];
}

function resumoChat(c: any): ChatResumo {
  const id: string = c.id?._serialized ?? String(c.id);
  const contato = c.contact;
  const nome = c.name || c.formattedTitle || contato?.name || contato?.pushname || contato?.verifiedName || '';
  const ultima = c.msgs?.last?.() ?? c.lastReceivedKey;
  return {
    id,
    nome,
    numero: numeroDe(contato?.phoneNumber?._serialized ?? id),
    grupo: !!c.isGroup,
    naoLidas: c.unreadCount ?? 0,
    t: c.t ?? 0,
    arquivado: !!c.archive,
    ultimaMsg: (ultima?.body ?? ultima?.caption ?? '').toString().slice(0, 120),
    etiquetas: (c.labels ?? []).map(String),
  };
}

/**
 * Conversa aberta agora. O wa-js procura a flag `active`, que nem toda versão do WhatsApp preenche;
 * se falhar, compara o nome no cabeçalho da conversa aberta (#main header) com a lista de chats.
 */
function chatAberto(): any {
  try {
    const c = WPP.chat.getActiveChat();
    if (c) return c;
  } catch {
    // segue para o plano B
  }
  const titulo = document.querySelector('#main header span[dir="auto"]')?.textContent?.trim();
  if (!titulo) return null;
  const todos: any[] = WPP.whatsapp.ChatStore.getModelsArray?.() ?? [];
  const soDigitos = titulo.replace(/\D/g, '');
  return (
    todos.find((c) => (c.formattedTitle || c.name || c.contact?.name || c.contact?.pushname) === titulo) ??
    (soDigitos.length >= 10 ? todos.find((c) => numeroDe(c.contact?.phoneNumber?._serialized ?? c.id?._serialized ?? '') === soDigitos) : undefined) ??
    null
  );
}

function resumoEtiqueta(l: any): EtiquetaWA {
  return { id: String(l.id), nome: l.name ?? '', cor: l.hexColor ?? '#8a8f98', qtd: l.count ?? 0 };
}

function resumoMsg(m: any): MsgResumo {
  return {
    id: m.id?._serialized ?? '',
    chatId: (m.id?.remote?._serialized ?? m.from?._serialized ?? '') as string,
    deMim: !!m.id?.fromMe,
    texto: (m.body ?? m.caption ?? '').toString(),
    tipo: m.type ?? 'chat',
    t: m.t ?? 0,
  };
}

async function dataUrlParaBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob();
}

const metodos: { [K in keyof Metodos]: (...a: Parameters<Metodos[K]>) => ReturnType<Metodos[K]> | Promise<ReturnType<Metodos[K]>> } = {
  pronto: () => !!WPP?.isFullReady,
  eu: () => WPP.conn.getMyUserId()?._serialized ?? null,
  listarChats: async () => (await WPP.chat.list()).map(resumoChat),
  chatAtivo: () => {
    const c = chatAberto();
    return c ? resumoChat(c) : null;
  },
  abrirChat: async (chatId) => !!(await WPP.chat.openChatBottom(chatId)),
  enviarTexto: async (chatId, texto, mencoes) => {
    const r = await WPP.chat.sendTextMessage(chatId, texto, { createChat: true, mentionedList: mencoes?.length ? mencoes : undefined });
    return r?.id ?? '';
  },
  enviarArquivo: async (chatId, dataUrl, o) => {
    const blob = await dataUrlParaBlob(dataUrl);
    const r = await WPP.chat.sendFileMessage(chatId, blob, {
      type: o.tipo,
      caption: o.legenda,
      filename: o.nomeArquivo,
      isPtt: o.ptt,
      // onda sonora no balão, igual a um áudio gravado no celular
      waveform: o.ptt ? true : undefined,
      createChat: true,
    });
    return r?.id ?? '';
  },
  escreverNoCampo: async (chatId, texto) => {
    await WPP.chat.openChatBottom(chatId);
    await WPP.chat.setInputText(texto);
    return true;
  },
  filtrarLista: async (ids) => {
    if (ids === null) await WPP.chat.setChatList('all');
    else await WPP.chat.setChatList('custom', ids.length ? ids : ['0@c.us']);
    return true;
  },
  filtrarNativo: async (tipo) => {
    await WPP.chat.setChatList(tipo);
    return true;
  },
  simular: async (chatId, tipo, segundos) => {
    const ms = Math.max(0, Math.min(60, segundos)) * 1000;
    if (!ms) return true;
    // o wa-js só resolve depois de `ms` (e volta para "pausado" sozinho)
    if (tipo === 'gravando') await WPP.chat.markIsRecording(chatId, ms);
    else await WPP.chat.markIsComposing(chatId, ms);
    return true;
  },
  arquivar: async (chatId, arquivar) => {
    await WPP.chat.archive(chatId, arquivar);
    return true;
  },
  eBusiness: async () => {
    try {
      return !!(await WPP.profile.isBusiness());
    } catch {
      return false;
    }
  },
  etiquetas: async () => {
    try {
      return (await WPP.labels.getAllLabels()).map(resumoEtiqueta);
    } catch {
      return [];
    }
  },
  paletaEtiquetas: async () => {
    try {
      return await WPP.labels.getLabelColorPalette();
    } catch {
      return [];
    }
  },
  criarEtiqueta: async (nome, cor) => resumoEtiqueta(await WPP.labels.addNewLabel(nome, { labelColor: cor })),
  editarEtiqueta: async (id, nome, cor) => resumoEtiqueta(await WPP.labels.editLabel(id, { name: nome, labelColor: cor })),
  apagarEtiqueta: async (id) => {
    await WPP.labels.deleteLabel(id);
    return true;
  },
  etiquetarChat: async (chatIds, mudancas) => {
    await WPP.labels.addOrRemoveLabels(chatIds, mudancas.map((m) => ({ labelId: m.id, type: m.tipo })));
    return true;
  },
  enviarDoCampo: async (texto) => {
    await WPP.chat.setInputText(texto);
    await new Promise((ok) => setTimeout(ok, 80));
    const botao =
      document.querySelector<HTMLElement>('footer button[aria-label="Enviar"], footer button[aria-label="Send"]') ??
      document.querySelector<HTMLElement>('footer span[data-icon="send"], footer span[data-icon="wds-ic-send-filled"]')?.closest<HTMLElement>('button');
    if (!botao) return false;
    botao.click();
    return true;
  },
  postarStatus: async (tipo, conteudo, o) => {
    if (tipo === 'texto') await WPP.status.sendTextStatus(conteudo, { backgroundColor: o.corFundo, waitForAck: true });
    else if (tipo === 'image') await WPP.status.sendImageStatus(conteudo, { caption: o.legenda, waitForAck: true });
    else await WPP.status.sendVideoStatus(conteudo, { caption: o.legenda, waitForAck: true });
    return true;
  },
  ultimasMensagens: async (chatId, qtd) => {
    const msgs = await WPP.chat.getMessages(chatId, { count: Math.min(50, Math.max(1, qtd)) });
    return msgs.map(resumoMsg).filter((m: MsgResumo) => m.texto);
  },
  foto: async (chatId) => {
    try {
      return (await WPP.contact.getProfilePictureUrl(chatId)) ?? null;
    } catch {
      return null;
    }
  },
  existeNumero: async (numero) => {
    const r = await WPP.contact.queryExists(`${numero.replace(/\D/g, '')}@c.us`);
    return r?.wid?._serialized ?? null;
  },
  participantes: async (grupoId) => {
    const lista = await WPP.group.getParticipants(grupoId);
    return lista.map((p: any) => {
      const id = p.id?._serialized ?? String(p.id);
      const contato = p.contact;
      return {
        id,
        numero: numeroDe(contato?.phoneNumber?._serialized ?? id),
        nome: contato?.name || contato?.pushname || '',
        admin: !!(p.isAdmin || p.isSuperAdmin),
      };
    });
  },
};

window.addEventListener('message', async (e) => {
  if (e.source !== window || e.data?.src !== REQ) return;
  const req = e.data as Requisicao;
  const fn = metodos[req.metodo] as ((...a: unknown[]) => unknown) | undefined;
  let resp: Resposta;
  try {
    if (!fn) throw new Error(`método desconhecido: ${req.metodo}`);
    resp = { src: RES, id: req.id, ok: true, valor: await fn(...(req.args as unknown[])) };
  } catch (err) {
    resp = { src: RES, id: req.id, ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
  window.postMessage(resp, location.origin);
});

function quandoPronto() {
  emitir({ tipo: 'pronto' });
  // o evento do wa-js nem sempre dispara nas versões novas do WhatsApp: confere a conversa aberta a cada 700 ms
  let ultimo: string | null = null;
  const conferir = () => {
    let c: any = null;
    try {
      c = chatAberto();
    } catch {
      c = null;
    }
    const id = c ? (c.id?._serialized ?? String(c.id)) : null;
    if (id === ultimo) return;
    ultimo = id;
    emitir({ tipo: 'chat_ativo', chat: c ? resumoChat(c) : null });
  };
  WPP.on('chat.active_chat', conferir);
  setInterval(conferir, 700);
  conferir();
  WPP.on('chat.new_message', (m: any) => emitir({ tipo: 'nova_msg', msg: resumoMsg(m) }));
  WPP.on('chat.update_label', () => emitir({ tipo: 'etiquetas_mudaram' }));
}

const aguardaWPP = setInterval(() => {
  if (typeof WPP === 'undefined') return;
  clearInterval(aguardaWPP);
  if (WPP.isFullReady) quandoPronto();
  else WPP.webpack.onFullReady(quandoPronto);
}, 300);
