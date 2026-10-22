// Contrato entre o content script (mundo isolado) e a ponte (mundo da página, onde vive o WPP).
// Os dois lados trocam window.postMessage com estes marcadores.
export const REQ = 'crmw:req';
export const RES = 'crmw:res';
export const EVT = 'crmw:evt';

export interface ChatResumo {
  id: string;
  nome: string;
  numero: string;
  grupo: boolean;
  naoLidas: number;
  /** timestamp (segundos) da última atividade */
  t: number;
  arquivado: boolean;
  ultimaMsg: string;
  /** ids das etiquetas do WhatsApp Business */
  etiquetas: string[];
}

export interface EtiquetaWA {
  id: string;
  nome: string;
  cor: string;
  qtd: number;
}

export type FiltroNativo = 'unread' | 'group' | 'personal';

export interface MsgResumo {
  id: string;
  chatId: string;
  deMim: boolean;
  texto: string;
  tipo: string;
  t: number;
}

export interface Participante {
  id: string;
  numero: string;
  nome: string;
  admin: boolean;
}

/** Métodos que a ponte expõe. Cada chave = nome do método; args e retorno tipados. */
export interface Metodos {
  pronto(): boolean;
  eu(): string | null;
  listarChats(): ChatResumo[];
  chatAtivo(): ChatResumo | null;
  abrirChat(chatId: string): boolean;
  enviarTexto(chatId: string, texto: string, mencoes?: string[]): string;
  enviarArquivo(chatId: string, dataUrl: string, opcoes: { tipo: 'image' | 'video' | 'audio' | 'document'; legenda?: string; nomeArquivo?: string; ptt?: boolean }): string;
  escreverNoCampo(chatId: string, texto: string): boolean;
  filtrarLista(ids: string[] | null): boolean;
  filtrarNativo(tipo: FiltroNativo): boolean;
  simular(chatId: string, tipo: 'digitando' | 'gravando', segundos: number): boolean;
  arquivar(chatId: string, arquivar: boolean): boolean;
  eBusiness(): boolean;
  etiquetas(): EtiquetaWA[];
  paletaEtiquetas(): string[];
  criarEtiqueta(nome: string, cor: string): EtiquetaWA;
  editarEtiqueta(id: string, nome: string, cor: string): EtiquetaWA;
  apagarEtiqueta(id: string): boolean;
  etiquetarChat(chatIds: string[], mudancas: { id: string; tipo: 'add' | 'remove' }[]): boolean;
  postarStatus(tipo: 'texto' | 'image' | 'video', conteudo: string, opcoes: { legenda?: string; corFundo?: string }): boolean;
  /** últimas mensagens da conversa (mais antigas primeiro), para a IA ter contexto */
  ultimasMensagens(chatId: string, qtd: number): MsgResumo[];
  foto(chatId: string): string | null;
  existeNumero(numero: string): string | null;
  participantes(grupoId: string): Participante[];
}

export type NomeMetodo = keyof Metodos;

export interface Requisicao<M extends NomeMetodo = NomeMetodo> {
  src: typeof REQ;
  id: number;
  metodo: M;
  args: Parameters<Metodos[M]>;
}

export interface Resposta {
  src: typeof RES;
  id: number;
  ok: boolean;
  valor?: unknown;
  erro?: string;
}

export type Evento =
  | { src: typeof EVT; tipo: 'pronto' }
  | { src: typeof EVT; tipo: 'chat_ativo'; chat: ChatResumo | null }
  | { src: typeof EVT; tipo: 'nova_msg'; msg: MsgResumo }
  | { src: typeof EVT; tipo: 'etiquetas_mudaram' };
