// Dados do CRM: tudo em chrome.storage.local (fica no navegador, sem servidor).
// Cada coleção é uma chave; a extensão inteira (content, background) lê e escreve aqui.

export interface Etapa {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export interface Funil {
  id: string;
  nome: string;
  ordem: number;
  etapas: Etapa[];
}

/** Funil virtual cujas colunas são as etiquetas do WhatsApp Business. */
export const FUNIL_ETIQUETAS = '__etiquetas_wa__';

export interface Nota {
  id: string;
  texto: string;
  em: number;
  /** imagem ou arquivo anexado (data URL) */
  midia?: { arquivo: string; nome: string; tipo: string };
}

export interface StatusProgramado {
  id: string;
  tipo: 'texto' | 'image' | 'video';
  texto: string;
  arquivo?: string;
  nomeArquivo?: string;
  corFundo: string;
  quando: number;
  /** posta de novo a cada 24h */
  repetir24h: boolean;
  status: 'pendente' | 'postado' | 'falhou' | 'cancelado';
  erro?: string;
  postadoEm?: number;
}

export type EventoWebhook = 'etapa' | 'ficha' | 'mensagem_recebida' | 'resposta_enviada' | 'agendamento_enviado';

export const NOME_EVENTO_WEBHOOK: Record<EventoWebhook, string> = {
  etapa: 'Contato mudou de etapa',
  ficha: 'Ficha do contato alterada',
  mensagem_recebida: 'Mensagem recebida',
  resposta_enviada: 'Resposta rápida enviada',
  agendamento_enviado: 'Mensagem agendada enviada',
};

export interface Webhook {
  id: string;
  nome: string;
  url: string;
  eventos: EventoWebhook[];
  ativo: boolean;
}

export interface RegistroWebhook {
  id: string;
  webhookId: string;
  evento: EventoWebhook;
  em: number;
  ok: boolean;
  codigo?: number;
  erro?: string;
  corpo: unknown;
}

export type ProvedorIA = 'groq' | 'gemini' | 'openai';

export interface ConfigIA {
  provedor: ProvedorIA;
  chaves: Partial<Record<ProvedorIA, string>>;
  modelo: Partial<Record<ProvedorIA, string>>;
  /** como a empresa fala e o que vende (vai no contexto das sugestões de resposta) */
  sobreNegocio: string;
  tom: string;
}

export const MODELO_PADRAO_IA: Record<ProvedorIA, string> = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-3.1-flash-lite',
  openai: 'gpt-5-nano',
};

export interface Negocio {
  id: string;
  descricao: string;
  /** AAAA-MM-DD */
  data: string;
  valor: number;
}

export const ORIGENS = ['Indicação', 'Instagram', 'Facebook', 'Google', 'Site', 'Formulário', 'Grupo', 'Anúncio', 'Loja física', 'Outros'];

export interface Contato {
  /** id do chat no WhatsApp (5548999999999@c.us, ...@lid ou ...@g.us) */
  id: string;
  nome: string;
  numero: string;
  /** funilId → etapaId. O contato pode estar em vários funis ao mesmo tempo. */
  posicoes: Record<string, string>;
  tags: string[];
  email: string;
  empresa: string;
  cargo: string;
  cidade: string;
  estado: string;
  sexo: '' | 'F' | 'M' | 'O';
  /** AAAA-MM-DD */
  nascimento: string;
  origem: string;
  produtos: string;
  observacoes: string;
  negocios: Negocio[];
  notas: Nota[];
  criadoEm: number;
  atualizadoEm: number;
}

export type TipoResposta = 'texto' | 'image' | 'video' | 'audio' | 'document' | 'script';
export type Simulacao = 'nenhuma' | 'digitando' | 'gravando';

export interface AcoesResposta {
  arquivar: boolean;
  /** move o contato para esta etapa depois de enviar */
  mover: { funilId: string; etapaId: string } | null;
  /** etiqueta do WhatsApp Business adicionada depois de enviar */
  etiquetaWA: string | null;
}

export interface Categoria {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export interface RespostaRapida {
  id: string;
  atalho: string;
  titulo: string;
  tipo: TipoResposta;
  texto: string;
  /** mídia em data URL (imagem, áudio, vídeo, documento) */
  arquivo?: string;
  nomeArquivo?: string;
  ptt?: boolean;
  /** script: ids das respostas enviadas em sequência */
  passos?: string[];
  /** script: segundos de espera entre um passo e outro */
  intervalo?: number;
  categoriaId: string | null;
  simular: Simulacao;
  /** segundos de "digitando"/"gravando" antes de enviar */
  simularSeg: number;
  acoes: AcoesResposta;
  usos: number;
  ordem: number;
}

export type TipoRecorrencia = 'nenhuma' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'dias';

export interface Recorrencia {
  tipo: TipoRecorrencia;
  /** só para tipo 'dias': a cada N dias */
  cada?: number;
}

export interface Agendamento {
  id: string;
  chatId: string;
  nomeContato: string;
  texto: string;
  respostaId?: string;
  quando: number;
  recorrencia: Recorrencia;
  status: 'pendente' | 'enviando' | 'enviado' | 'falhou' | 'cancelado';
  erro?: string;
  enviadoEm?: number;
}

export interface Lembrete {
  id: string;
  chatId: string;
  nomeContato: string;
  texto: string;
  quando: number;
  feito: boolean;
}

// ---------- envio para contatos ----------
// Envio simples, um por vez, para quem já conversa com você. Sem truques para driblar o WhatsApp:
// quem responder SAIR é descadastrado e nunca mais entra num envio.

export type StatusAlvo = 'pendente' | 'enviado' | 'falhou' | 'pulado';

export interface Alvo {
  /** id do chat quando conhecido; senão fica vazio e o número é conferido no WhatsApp na hora do envio */
  chatId: string;
  numero: string;
  nome: string;
  status: StatusAlvo;
  erro?: string;
  enviadoEm?: number;
}

export interface Campanha {
  id: string;
  nome: string;
  criadaEm: number;
  status: 'rascunho' | 'enviando' | 'pausada' | 'concluida' | 'cancelada';
  aviso?: string;
  texto: string;
  /** segundos entre uma mensagem e outra (escolhido pela pessoa) */
  intervaloSeg: number;
  rodapeSair: boolean;
  proximoEnvio?: number;
  alvos: Alvo[];
}

export const RODAPE_SAIR = 'Se não quiser mais receber mensagens como esta, responda SAIR.';

export interface Descadastro {
  numero: string;
  nome: string;
  em: number;
  motivo: string;
}

export interface Config {
  mostrarFaixa: boolean;
  funilAtivo: string;
  /** ids das etiquetas do WhatsApp na ordem escolhida para o quadro */
  ordemEtiquetas: string[];
  privacidade: Privacidade;
  assinatura: { ativa: boolean; nome: string };
  backupAuto: { ativo: boolean; hora: string; ultimo?: string };
}

export interface Privacidade {
  ativa: boolean;
  fotos: boolean;
  nomes: boolean;
  ultimaMsg: boolean;
  mensagens: boolean;
  midia: boolean;
}

export interface Banco {
  funis: Funil[];
  contatos: Record<string, Contato>;
  respostas: RespostaRapida[];
  categorias: Categoria[];
  agendamentos: Agendamento[];
  lembretes: Lembrete[];
  campanhas: Campanha[];
  statusProgramados: StatusProgramado[];
  webhooks: Webhook[];
  /** últimos 30 envios de webhook */
  registrosWebhook: RegistroWebhook[];
  ia: ConfigIA;
  /** número → quem pediu para não receber mais */
  descadastros: Record<string, Descadastro>;
  config: Config;
}

export const ETAPAS_PADRAO: Etapa[] = [
  { id: 'novo', nome: 'Novo contato', cor: '#5B8DEF', ordem: 0 },
  { id: 'atendimento', nome: 'Em atendimento', cor: '#E0A030', ordem: 1 },
  { id: 'proposta', nome: 'Proposta enviada', cor: '#B96AD9', ordem: 2 },
  { id: 'fechado', nome: 'Fechado', cor: '#3FA66B', ordem: 3 },
  { id: 'perdido', nome: 'Perdido', cor: '#8A8F98', ordem: 4 },
];

const PADRAO: Banco = {
  funis: [{ id: 'principal', nome: 'Vendas', ordem: 0, etapas: ETAPAS_PADRAO }],
  contatos: {},
  respostas: [],
  categorias: [],
  agendamentos: [],
  lembretes: [],
  campanhas: [],
  statusProgramados: [],
  webhooks: [],
  registrosWebhook: [],
  ia: { provedor: 'groq', chaves: {}, modelo: {}, sobreNegocio: '', tom: 'cordial e direto, em português do Brasil' },
  descadastros: {},
  config: {
    mostrarFaixa: true,
    funilAtivo: 'principal',
    ordemEtiquetas: [],
    privacidade: { ativa: false, fotos: true, nomes: true, ultimaMsg: true, mensagens: false, midia: true },
    assinatura: { ativa: false, nome: '' },
    backupAuto: { ativo: false, hora: '18:00' },
  },
};

export type Chave = keyof Banco;

// ---------- normalização: registros antigos ganham os campos novos ----------

export function normContato(c: Partial<Contato> & { id: string; etapaId?: string | null; valor?: number | null }): Contato {
  const base = contatoVazio(c.id, c.nome ?? '', c.numero ?? '');
  const n: Contato = { ...base, ...c, posicoes: { ...(c.posicoes ?? {}) }, negocios: c.negocios ?? [], notas: c.notas ?? [], tags: c.tags ?? [] };
  // fase 1 guardava uma etapa só e um valor só
  if (c.etapaId && !Object.keys(n.posicoes).length) n.posicoes.principal = c.etapaId;
  if (c.valor && !n.negocios.length) n.negocios.push({ id: novoId(), descricao: 'Negócio', data: new Date(c.criadoEm ?? Date.now()).toISOString().slice(0, 10), valor: c.valor });
  delete (n as any).etapaId;
  delete (n as any).valor;
  return n;
}

export function normResposta(r: Partial<RespostaRapida> & { id: string }): RespostaRapida {
  return {
    atalho: '',
    titulo: '',
    tipo: 'texto',
    texto: '',
    categoriaId: null,
    simular: 'nenhuma',
    simularSeg: 3,
    usos: 0,
    ordem: 0,
    ...r,
    acoes: { arquivar: false, mover: null, etiquetaWA: null, ...(r.acoes ?? {}) },
  };
}

function normalizar<K extends Chave>(chave: K, v: any): Banco[K] {
  if (v == null) return structuredClone(PADRAO[chave]);
  if (chave === 'contatos') {
    const out: Record<string, Contato> = {};
    for (const [id, c] of Object.entries(v as Record<string, any>)) out[id] = normContato({ ...c, id });
    return out as Banco[K];
  }
  if (chave === 'respostas') return (v as any[]).map(normResposta) as Banco[K];
  if (chave === 'agendamentos') return (v as any[]).map((a) => ({ recorrencia: { tipo: 'nenhuma' }, ...a })) as Banco[K];
  if (chave === 'config')
    return {
      ...PADRAO.config,
      ...v,
      privacidade: { ...PADRAO.config.privacidade, ...v.privacidade },
      assinatura: { ...PADRAO.config.assinatura, ...v.assinatura },
      backupAuto: { ...PADRAO.config.backupAuto, ...v.backupAuto },
    } as Banco[K];
  if (chave === 'ia') return { ...PADRAO.ia, ...v, chaves: { ...(v.chaves ?? {}) }, modelo: { ...(v.modelo ?? {}) } } as Banco[K];
  if (chave === 'campanhas') return (v as any[]).map((c) => ({ intervaloSeg: 20, rodapeSair: true, texto: '', ...c })) as Banco[K];
  return v;
}

/** Migração da fase 1 (chave 'etapas' solta) para o modelo com vários funis. */
let migrado: Promise<void> | null = null;
function migrar() {
  migrado ??= (async () => {
    const r = await chrome.storage.local.get(['etapas', 'funis']);
    if (r.etapas && !r.funis) {
      await chrome.storage.local.set({ funis: [{ id: 'principal', nome: 'Vendas', ordem: 0, etapas: r.etapas }] });
      await chrome.storage.local.remove('etapas');
    }
  })();
  return migrado;
}

export async function ler<K extends Chave>(chave: K): Promise<Banco[K]> {
  await migrar();
  const r = await chrome.storage.local.get(chave);
  return normalizar(chave, r[chave]);
}

export async function gravar<K extends Chave>(chave: K, valor: Banco[K]) {
  await chrome.storage.local.set({ [chave]: valor });
}

export async function alterar<K extends Chave>(chave: K, fn: (atual: Banco[K]) => Banco[K] | void) {
  const atual = await ler(chave);
  const novo = fn(atual) ?? atual;
  await gravar(chave, novo);
  return novo;
}

export function aoMudar<K extends Chave>(chave: K, fn: (valor: Banco[K]) => void) {
  const ouvinte = (mud: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && chave in mud) fn(normalizar(chave, mud[chave].newValue));
  };
  chrome.storage.onChanged.addListener(ouvinte);
  return () => chrome.storage.onChanged.removeListener(ouvinte);
}

export async function exportarTudo(): Promise<Banco> {
  const b = {} as Banco;
  for (const k of Object.keys(PADRAO) as Chave[]) (b as any)[k] = await ler(k);
  return b;
}

export async function importarTudo(b: Partial<Banco> & { etapas?: Etapa[] }) {
  const permitido: Record<string, unknown> = {};
  for (const k of Object.keys(PADRAO) as Chave[]) if (k in b) permitido[k] = normalizar(k, (b as any)[k]);
  // backup da fase 1
  if (b.etapas && !b.funis) permitido.funis = [{ id: 'principal', nome: 'Vendas', ordem: 0, etapas: b.etapas }];
  await chrome.storage.local.set(permitido);
}

export const novoId = () => crypto.randomUUID().slice(0, 12);

export function contatoVazio(id: string, nome: string, numero: string): Contato {
  const agora = Date.now();
  return {
    id, nome, numero, posicoes: {}, tags: [], email: '', empresa: '', cargo: '', cidade: '', estado: '', sexo: '', nascimento: '',
    origem: '', produtos: '', observacoes: '', negocios: [], notas: [], criadoEm: agora, atualizadoEm: agora,
  };
}

export const totalNegocios = (c?: Contato) => c?.negocios.reduce((s, n) => s + n.valor, 0) ?? 0;

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Variáveis aceitas nas mensagens. A lista é mostrada no editor. */
export const VARIAVEIS = [
  'nome', 'primeiro_nome', 'saudacao', 'periodo_dia', 'numero', 'email', 'empresa', 'cargo', 'cidade', 'estado', 'origem', 'produtos', 'valor_negocio', 'mencionar_todos',
] as const;

/** Troca {{variavel}} pelos dados do contato. {{mencionar_todos}} é tratado no envio (precisa dos participantes do grupo). */
export function aplicarVariaveis(texto: string, c: Partial<Contato>) {
  const h = new Date().getHours();
  const nome = (c.nome ?? '').trim();
  const valores: Record<string, string> = {
    nome,
    primeiro_nome: nome.split(/\s+/)[0] ?? '',
    saudacao: h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite',
    periodo_dia: h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite',
    numero: c.numero ?? '',
    email: c.email ?? '',
    empresa: c.empresa ?? '',
    cargo: c.cargo ?? '',
    cidade: c.cidade ?? '',
    estado: c.estado ?? '',
    origem: c.origem ?? '',
    produtos: c.produtos ?? '',
    valor_negocio: c.negocios?.length ? fmtMoeda.format(totalNegocios(c as Contato)) : '',
  };
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (todo, k: string) => {
    const chave = k.toLowerCase();
    return chave in valores ? valores[chave] : todo;
  });
}

// ---------- números ----------

export const PALAVRAS_SAIR = ['sair', 'parar', 'pare', 'stop', 'descadastrar', 'remover'];

/** "(48) 99999-8888" → "5548999998888". Números brasileiros sem DDI ganham 55. */
export function normalizarNumero(bruto: string) {
  let d = bruto.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 15 ? d : '';
}

// ---------- recorrência ----------

export const NOME_RECORRENCIA: Record<TipoRecorrencia, string> = {
  nenhuma: 'Não repete',
  diaria: 'Todo dia',
  semanal: 'Toda semana',
  quinzenal: 'A cada 15 dias',
  mensal: 'Todo mês',
  trimestral: 'A cada 3 meses',
  semestral: 'A cada 6 meses',
  anual: 'Todo ano',
  dias: 'A cada N dias',
};

/** Próxima data depois de `quando` (sempre no futuro em relação a `agora`). null se não repete. */
export function proximaData(quando: number, r: Recorrencia, agora = Date.now()): number | null {
  if (r.tipo === 'nenhuma') return null;
  const d = new Date(quando);
  const passo = () => {
    switch (r.tipo) {
      case 'diaria': d.setDate(d.getDate() + 1); break;
      case 'semanal': d.setDate(d.getDate() + 7); break;
      case 'quinzenal': d.setDate(d.getDate() + 15); break;
      case 'dias': d.setDate(d.getDate() + Math.max(1, r.cada ?? 1)); break;
      case 'mensal': d.setMonth(d.getMonth() + 1); break;
      case 'trimestral': d.setMonth(d.getMonth() + 3); break;
      case 'semestral': d.setMonth(d.getMonth() + 6); break;
      case 'anual': d.setFullYear(d.getFullYear() + 1); break;
    }
  };
  do passo();
  while (d.getTime() <= agora);
  return d.getTime();
}
