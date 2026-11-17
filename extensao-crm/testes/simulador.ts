// Simulador do WhatsApp para testar o atendimento automático sem navegador.
// Substitui src/content/wa.ts e src/content/iaCliente.ts no build dos testes (ver testes/rodar.mjs).
import type { Evento, Metodos, MsgResumo, NomeMetodo } from '../src/shared/protocolo';

export interface MsgSim extends MsgResumo {}

const ouvintes = new Set<(e: Evento) => void>();
let seq = 0;

export const sim = {
  /** chatId → mensagens (mais antigas primeiro) */
  chats: new Map<string, MsgSim[]>(),
  salvos: new Set<string>(),
  /** o que o robô mandou, na ordem */
  enviados: [] as { chatId: string; texto: string; tipo: string }[],
  /** respostas da IA em fila; função recebe o contexto */
  ia: (contexto: string): string | Error => 'Resposta da IA',
  chamadasIA: [] as string[],
  limpar() {
    this.chats.clear();
    this.salvos.clear();
    this.enviados = [];
    this.chamadasIA = [];
    this.ia = () => 'Resposta da IA';
  },
  /** coloca mensagem no histórico sem disparar evento (conversa antiga) */
  historico(chatId: string, deMim: boolean, texto: string, segAtras: number) {
    const m: MsgSim = { id: `h${++seq}`, chatId, deMim, texto, tipo: 'chat', t: Math.floor(Date.now() / 1000) - segAtras };
    this.lista(chatId).push(m);
  },
  lista(chatId: string) {
    if (!this.chats.has(chatId)) this.chats.set(chatId, []);
    return this.chats.get(chatId)!;
  },
  /** chega mensagem do cliente (dispara o evento como o WhatsApp) */
  cliente(chatId: string, texto: string, opcoes: { tipo?: string; segAtras?: number; cifrada?: boolean } = {}) {
    const m: MsgSim = { id: `c${++seq}`, chatId, deMim: false, texto, tipo: opcoes.tipo ?? 'chat', t: Math.floor(Date.now() / 1000) - (opcoes.segAtras ?? 0) };
    this.lista(chatId).push(m);
    if (opcoes.cifrada) {
      // o WhatsApp manda primeiro "ciphertext" (sem texto) e depois a mensagem de verdade, com o mesmo id
      emitir({ src: 'crmw:evt', tipo: 'nova_msg', msg: { ...m, tipo: 'ciphertext', texto: '' } });
    }
    emitir({ src: 'crmw:evt', tipo: 'nova_msg', msg: m });
    return m;
  },
  /** alguém da equipe escreve pelo celular */
  equipe(chatId: string, texto: string) {
    const m: MsgSim = { id: `e${++seq}`, chatId, deMim: true, texto, tipo: 'chat', t: Math.floor(Date.now() / 1000) };
    this.lista(chatId).push(m);
    emitir({ src: 'crmw:evt', tipo: 'nova_msg', msg: m });
  },
};

function emitir(e: Evento) {
  ouvintes.forEach((fn) => fn(e));
}

/** envio do robô: o evento do WhatsApp chega ANTES do id voltar (igual na vida real) */
async function mandar(chatId: string, texto: string, tipo: string) {
  const m: MsgSim = { id: `r${++seq}`, chatId, deMim: true, texto, tipo, t: Math.floor(Date.now() / 1000) };
  sim.lista(chatId).push(m);
  sim.enviados.push({ chatId, texto, tipo });
  emitir({ src: 'crmw:evt', tipo: 'nova_msg', msg: m });
  await new Promise((ok) => setTimeout(ok, 30));
  return m.id;
}

const metodos: Partial<{ [K in NomeMetodo]: (...a: Parameters<Metodos[K]>) => Promise<Awaited<ReturnType<Metodos[K]>>> }> = {
  historico: async (chatId, qtd) => sim.lista(chatId).filter((m) => !m.sistema).slice(-qtd),
  infoChat: async (chatId) => ({ salvo: sim.salvos.has(chatId), nome: 'Cliente Teste', numero: chatId.split('@')[0] }),
  enviarTexto: async (chatId, texto) => mandar(chatId, texto, 'chat'),
  enviarArquivo: async (chatId, _url, o) => mandar(chatId, o.legenda ?? '', o.tipo),
  simular: async () => true,
  etiquetarChat: async () => true,
  arquivar: async () => true,
  eu: async () => '5548000000000@c.us',
  participantes: async () => [],
  // usados só pela prévia visual
  pronto: async () => true,
  listarChats: async () => [
    { id: '5548999990001@c.us', nome: 'Maria Silva', numero: '5548999990001', grupo: false, naoLidas: 2, t: Date.now() / 1000, arquivado: false, ultimaMsg: 'oi', etiquetas: [] },
    { id: '5548999990002@c.us', nome: 'João Pedro', numero: '5548999990002', grupo: false, naoLidas: 0, t: Date.now() / 1000 - 600, arquivado: false, ultimaMsg: 'obrigado', etiquetas: [] },
  ],
  chatAtivo: async () => null,
  eBusiness: async () => false,
  etiquetas: async () => [],
  foto: async () => null,
  filtrarLista: async () => true,
  filtrarNativo: async () => true,
};

export function wa<M extends NomeMetodo>(metodo: M, ...args: Parameters<Metodos[M]>): Promise<Awaited<ReturnType<Metodos[M]>>> {
  const fn = metodos[metodo] as ((...a: unknown[]) => Promise<never>) | undefined;
  if (!fn) return Promise.reject(new Error(`simulador sem o método ${metodo}`));
  return fn(...(args as unknown[]));
}

export function aoEvento(fn: (e: Evento) => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export async function pedirIA(_acao: string, _texto: string, contexto?: string): Promise<string> {
  sim.chamadasIA.push(contexto ?? '');
  await new Promise((ok) => setTimeout(ok, 20));
  const r = sim.ia(contexto ?? '');
  if (r instanceof Error) throw r;
  return r;
}
