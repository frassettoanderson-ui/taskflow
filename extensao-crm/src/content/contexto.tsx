import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { alterar, contatoVazio, type Config, type Contato, type Funil } from '../shared/dados';
import type { ChatResumo, EtiquetaWA } from '../shared/protocolo';
import { emitirWebhook } from '../shared/webhook';
import { useColecao } from '../ui/hooks';

/** Ficha sem anexos pesados, para mandar nos webhooks. */
export function contatoParaWebhook(c: Contato) {
  const { notas, ...resto } = c;
  return { ...resto, notas: notas.map((n) => ({ texto: n.texto, em: n.em })) };
}
import { aoEvento, wa } from './wa';

interface Aviso {
  id: number;
  texto: string;
  erro?: boolean;
}

interface CRM {
  chats: ChatResumo[];
  chatPorId: Map<string, ChatResumo>;
  ativo: ChatResumo | null;
  contatos: Record<string, Contato>;
  funis: Funil[];
  config: Config | undefined;
  /** etiquetas do WhatsApp Business, já na ordem escolhida (vazio se a conta não for Business) */
  etiquetasWA: EtiquetaWA[];
  business: boolean;
  avisar: (texto: string, erro?: boolean) => void;
  /** Cria ou altera a ficha do contato do chat informado. */
  salvarContato: (chat: Pick<ChatResumo, 'id' | 'nome' | 'numero'>, fn: (c: Contato) => void) => Promise<void>;
  atualizarChats: () => void;
  atualizarEtiquetas: () => void;
}

const Ctx = createContext<CRM | null>(null);
export const useCRM = () => useContext(Ctx)!;

export function ProvedorCRM({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<ChatResumo[]>([]);
  const [ativo, setAtivo] = useState<ChatResumo | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [etiquetasBrutas, setEtiquetas] = useState<EtiquetaWA[]>([]);
  const [business, setBusiness] = useState(false);
  const contatos = useColecao('contatos') ?? {};
  const funis = useColecao('funis') ?? [];
  const config = useColecao('config');
  const agendado = useRef<number>();

  const atualizarChats = useCallback(() => {
    clearTimeout(agendado.current);
    agendado.current = window.setTimeout(() => {
      wa('listarChats').then(setChats).catch(() => {});
    }, 400);
  }, []);

  const atualizarEtiquetas = useCallback(() => {
    wa('etiquetas').then(setEtiquetas).catch(() => {});
  }, []);

  useEffect(() => {
    atualizarChats();
    wa('chatAtivo').then(setAtivo).catch(() => {});
    wa('eBusiness')
      .then((b) => {
        setBusiness(b);
        if (b) atualizarEtiquetas();
      })
      .catch(() => {});
    const t = setInterval(atualizarChats, 30_000);
    const desliga = aoEvento((e) => {
      if (e.tipo === 'chat_ativo') setAtivo(e.chat);
      if (e.tipo === 'nova_msg') {
        atualizarChats();
        if (!e.msg.deMim) emitirWebhook('mensagem_recebida', { chatId: e.msg.chatId, numero: e.msg.chatId.split('@')[0], texto: e.msg.texto, tipo: e.msg.tipo, t: e.msg.t });
      }
      if (e.tipo === 'etiquetas_mudaram') {
        atualizarEtiquetas();
        atualizarChats();
      }
    });
    return () => {
      clearInterval(t);
      desliga();
    };
  }, [atualizarChats, atualizarEtiquetas]);

  // mantém o chat ativo com as etiquetas atualizadas
  useEffect(() => {
    if (!ativo) return;
    const novo = chats.find((c) => c.id === ativo.id);
    if (novo && novo.etiquetas.join() !== ativo.etiquetas.join()) setAtivo(novo);
  }, [chats]);

  const etiquetasWA = useMemo(() => {
    const ordem = config?.ordemEtiquetas ?? [];
    const pos = (id: string) => {
      const i = ordem.indexOf(id);
      return i < 0 ? 1e6 : i;
    };
    return [...etiquetasBrutas].sort((a, b) => pos(a.id) - pos(b.id));
  }, [etiquetasBrutas, config?.ordemEtiquetas]);

  const avisar = useCallback((texto: string, erro?: boolean) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, erro }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3200);
  }, []);

  const salvarContato = useCallback<CRM['salvarContato']>(async (chat, fn) => {
    let antes: Record<string, string> = {};
    let depois: Contato | null = null;
    await alterar('contatos', (todos) => {
      const c = todos[chat.id] ?? contatoVazio(chat.id, chat.nome, chat.numero);
      antes = { ...c.posicoes };
      if (!c.nome && chat.nome) c.nome = chat.nome;
      fn(c);
      c.atualizadoEm = Date.now();
      todos[chat.id] = c;
      depois = c;
    });
    if (!depois) return;
    const final: Contato = depois;
    const contato = contatoParaWebhook(final);
    for (const funilId of new Set([...Object.keys(antes), ...Object.keys(final.posicoes)])) {
      if (antes[funilId] !== final.posicoes[funilId]) emitirWebhook('etapa', { contato, funilId, de: antes[funilId] ?? null, para: final.posicoes[funilId] ?? null });
    }
    emitirWebhook('ficha', { contato });
  }, []);

  const chatPorId = useMemo(() => new Map(chats.map((c) => [c.id, c])), [chats]);

  const valor = useMemo<CRM>(
    () => ({ chats, chatPorId, ativo, contatos, funis, config, etiquetasWA, business, avisar, salvarContato, atualizarChats, atualizarEtiquetas }),
    [chats, chatPorId, ativo, contatos, funis, config, etiquetasWA, business, avisar, salvarContato, atualizarChats, atualizarEtiquetas],
  );

  return (
    <Ctx.Provider value={valor}>
      {children}
      {avisos.map((a) => (
        <div key={a.id} className={`aviso${a.erro ? ' aviso--erro' : ''}`} role="status">
          {a.texto}
        </div>
      ))}
    </Ctx.Provider>
  );
}

/** Funil escolhido na barra (cai no primeiro se o salvo não existir mais). */
export function useFunilAtivo(): Funil | null {
  const { funis, config } = useCRM();
  const ordenados = [...funis].sort((a, b) => a.ordem - b.ordem);
  return ordenados.find((f) => f.id === config?.funilAtivo) ?? ordenados[0] ?? null;
}
