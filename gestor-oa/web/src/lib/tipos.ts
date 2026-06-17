export type TipoIdentificador =
  | 'CNPJ'
  | 'CPF'
  | 'INSCRICAO_ESTADUAL'
  | 'CEI'
  | 'CAEPF';

export const LABEL_TIPO_IDENT: Record<TipoIdentificador, string> = {
  CNPJ: 'CNPJ',
  CPF: 'CPF',
  INSCRICAO_ESTADUAL: 'Inscricao Estadual',
  CEI: 'CEI',
  CAEPF: 'CAEPF',
};

export interface Departamento {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
}

export interface Tag {
  id: string;
  nome: string;
  cor: string;
  qtdEmpresas?: number;
}

export interface UsuarioBasico {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export interface EmpresaLista {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  ativo: boolean;
  cnpj: string | null;
  regimeTributarioId: string | null;
  tags: { id: string; nome: string; cor: string }[];
  qtdContatos: number;
}

export interface Identificador {
  id: string;
  tipo: TipoIdentificador;
  valor: string;
  apelido: string | null;
}

export interface Contato {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  cargo: string | null;
  departamentoIds: string[];
  obrigacaoIds: string[];
  ativo: boolean;
}

export interface Anexo {
  id: string;
  nomeArquivo: string;
  tamanho: number;
  mimeType: string | null;
  createdAt: string;
}

export interface Comentario {
  id: string;
  texto: string;
  createdAt: string;
  departamento: { nome: string; cor: string } | null;
}

export interface Responsavel {
  id: string;
  departamentoId: string;
  usuarioId: string;
}

export interface EmpresaDetalhe {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  emailPrincipal: string | null;
  telefone: string | null;
  endereco: string | null;
  regimeTributarioId: string | null;
  anotacoes: string | null;
  ativo: boolean;
  dataEntrada: string | null;
  dataSaida: string | null;
  identificadores: Identificador[];
  contatos: Contato[];
  anexos: Anexo[];
  comentarios: Comentario[];
  responsaveis: Responsavel[];
  tags: { tag: Tag }[];
}

export interface LogAuditoria {
  id: string;
  acao: string;
  entidade: string;
  createdAt: string;
  usuario: { nome: string } | null;
  antes: unknown;
  depois: unknown;
}

// ---------- Modulo 2 ----------
export type Periodicidade = 'MENSAL' | 'TRIMESTRAL' | 'ANUAL' | 'EVENTUAL';
export type OrigemObrigacao = 'REGIME' | 'GRUPO' | 'MANUAL';

export interface RegraPrazo {
  tipoDia: 'DIA_FIXO' | 'DIA_UTIL';
  dia: number;
  regraNaoUtil: 'ANTECIPA' | 'POSTERGA' | 'MANTEM';
  sabadoEhUtil?: boolean;
  diasAntesTecnico: number;
  tipoDiasAntes: 'CORRIDOS' | 'UTEIS';
}

export interface Obrigacao {
  id: string;
  nome: string;
  departamentoId: string | null;
  departamento?: { id: string; nome: string; cor: string } | null;
  descricao: string | null;
  periodicidade: Periodicidade;
  regraPrazo: RegraPrazo;
  tempoPrevistoMin: number;
  exigeAnexoNaBaixa: boolean;
  exigeBaixaPeloRobo: boolean;
  ativo: boolean;
  _count?: { empresaObrigacoes: number };
}

export interface RegimeObrigacaoLink {
  obrigacaoId: string;
  tempoPrevistoOverride: number | null;
  obrigacao: Obrigacao;
}
export interface Regime {
  id: string;
  nome: string;
  ativo: boolean;
  obrigacoes: RegimeObrigacaoLink[];
  _count?: { empresas: number };
}

export interface Grupo {
  id: string;
  nome: string;
  ativo: boolean;
  obrigacoes: { obrigacaoId: string; obrigacao: Obrigacao }[];
}

export interface Feriado {
  id: string;
  data: string;
  nome: string;
  abrangencia: string;
  uf: string | null;
  municipio: string | null;
}

export interface VinculoObrigacao {
  id: string;
  obrigacaoId: string;
  obrigacao: Obrigacao;
  origens: { origem: OrigemObrigacao; refId?: string | null }[];
  ativo: boolean;
  responsavelId: string | null;
  diaPrazoOverride: number | null;
  honorario: number | null;
  tempoPrevistoOverride: number | null;
}

export const LABEL_PERIODICIDADE: Record<Periodicidade, string> = {
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  ANUAL: 'Anual',
  EVENTUAL: 'Eventual',
};

export function descreverRegra(r: RegraPrazo): string {
  const base =
    r.tipoDia === 'DIA_UTIL' ? `${r.dia}o dia util` : `dia ${r.dia}`;
  const antes =
    r.diasAntesTecnico > 0
      ? ` (tecnico ${r.diasAntesTecnico}d ${r.tipoDiasAntes === 'UTEIS' ? 'uteis' : 'corridos'} antes)`
      : '';
  return base + antes;
}

// ---------- Modulo 3 ----------
export type StatusEntrega =
  | 'PENDENTE'
  | 'PENDENTE_ANTECIPADO'
  | 'EM_ATRASO_TECNICO'
  | 'EM_ATRASO_LEGAL'
  | 'ENTREGUE'
  | 'ENTREGUE_JUSTIFICADA'
  | 'DISPENSADA';

export const STATUS_INFO: Record<StatusEntrega, { label: string; cor: string }> = {
  PENDENTE_ANTECIPADO: { label: 'Pendente antecipado', cor: '#5cb85c' },
  PENDENTE: { label: 'Pendente no prazo', cor: '#5b9bd5' },
  EM_ATRASO_TECNICO: { label: 'Atraso tecnico', cor: '#f0ad4e' },
  EM_ATRASO_LEGAL: { label: 'Atraso legal', cor: '#cf3c5d' },
  ENTREGUE: { label: 'Entregue', cor: '#3a9d3a' },
  ENTREGUE_JUSTIFICADA: { label: 'Entregue c/ multa', cor: '#cf3c5d' },
  DISPENSADA: { label: 'Dispensada', cor: '#94a3b8' },
};

export interface Entrega {
  id: string;
  empresa: { id: string; razaoSocial: string };
  obrigacao: { id: string; nome: string; exigeAnexoNaBaixa: boolean; departamento: { nome: string; cor: string } | null };
  competencia: string;
  competenciaAno: number;
  competenciaMes: number;
  prazoLegal: string;
  prazoTecnico: string;
  status: StatusEntrega;
  statusBase: StatusEntrega;
  responsavelPrazoId: string | null;
  responsavelEntregaId: string | null;
  dataEntrega: string | null;
  justificativa: string | null;
  origemBaixa: 'MANUAL' | 'ROBO' | null;
  qtdAnexos: number;
}

// ---------- Modulo 4 ----------
export interface JanelaAcesso {
  diaSemana: number;
  inicio: string;
  fim: string;
}

export interface UsuarioCompleto {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  horariosAcesso: JanelaAcesso[];
  filtrosForcados: { departamentos?: string[]; tags?: string[] };
  permissoes: Record<string, boolean>;
}

export interface LogAuditoriaItem {
  id: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  antes: unknown;
  depois: unknown;
  createdAt: string;
  usuario: { nome: string } | null;
}

export const PERMISSION_GROUPS: { grupo: string; flags: { flag: string; label: string }[] }[] = [
  {
    grupo: 'Empresas',
    flags: [
      { flag: 'empresas_ver', label: 'Ver' },
      { flag: 'empresas_criar', label: 'Criar' },
      { flag: 'empresas_editar', label: 'Editar' },
      { flag: 'empresas_excluir', label: 'Excluir' },
      { flag: 'empresas_importar', label: 'Importar CSV' },
    ],
  },
  {
    grupo: 'Obrigacoes / Regimes / Grupos',
    flags: [
      { flag: 'obrigacoes_ver', label: 'Ver' },
      { flag: 'obrigacoes_gerenciar', label: 'Gerenciar' },
    ],
  },
  {
    grupo: 'Entregas',
    flags: [
      { flag: 'entregas_ver', label: 'Ver' },
      { flag: 'entregas_baixar', label: 'Dar baixa' },
      { flag: 'entregas_editar_prazos', label: 'Editar prazos' },
      { flag: 'entregas_acoes_massa', label: 'Acoes em massa' },
      { flag: 'entregas_desfazer_robo', label: 'Desfazer baixa do robo' },
      { flag: 'entregas_dispensar', label: 'Dispensar' },
    ],
  },
  {
    grupo: 'Processos',
    flags: [
      { flag: 'processos_ver', label: 'Ver' },
      { flag: 'processos_gerenciar_matrizes', label: 'Gerenciar matrizes' },
      { flag: 'processos_operar', label: 'Operar' },
    ],
  },
  {
    grupo: 'Documentos / GED',
    flags: [
      { flag: 'documentos_ver', label: 'Ver' },
      { flag: 'documentos_upload', label: 'Upload' },
      { flag: 'documentos_excluir', label: 'Excluir' },
    ],
  },
  { grupo: 'Relatorios', flags: [{ flag: 'relatorios_ver', label: 'Ver relatorios e insights' }] },
  {
    grupo: 'Metodo APLA',
    flags: [
      { flag: 'apla_ver', label: 'Ver relatorios' },
      { flag: 'apla_configurar', label: 'Configurar' },
    ],
  },
  {
    grupo: 'Area VIP / App',
    flags: [
      { flag: 'portal_comunicados', label: 'Gerenciar comunicados' },
      { flag: 'portal_solicitacoes', label: 'Gerenciar solicitacoes' },
      { flag: 'portal_configurar', label: 'Configurar' },
    ],
  },
  {
    grupo: 'Solicitacoes internas',
    flags: [
      { flag: 'solicitacoes_internas_ver', label: 'Ver e participar' },
      { flag: 'solicitacoes_internas_gerenciar', label: 'Gerenciar (atribuir/excluir)' },
    ],
  },
  {
    grupo: 'Administracao',
    flags: [
      { flag: 'admin_usuarios', label: 'Gerenciar usuarios' },
      { flag: 'admin_permissoes', label: 'Gerenciar permissoes' },
      { flag: 'admin_auditoria', label: 'Ver auditoria' },
      { flag: 'admin_escritorio', label: 'Configuracoes do escritorio' },
    ],
  },
];

export const DIAS_SEMANA_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

// ---------- Modulo 7 ----------
export interface DocumentoGED {
  id: string;
  raiz: string;
  pasta: string;
  nomeArquivo: string;
  tamanho: number;
  mimeType: string | null;
  origem: 'MANUAL' | 'ENTREGA' | 'ROBO';
  createdAt: string;
}

export interface ProtocoloVisualizacao {
  id: string;
  ip: string | null;
  userAgent: string | null;
  visualizadoEm: string;
}

export interface Protocolo {
  id: string;
  token: string;
  destinatario: string;
  canal: 'EMAIL' | 'AREA_VIP' | 'WHATSAPP';
  enviadoEm: string;
  documento: { nomeArquivo: string } | null;
  visualizacoes: ProtocoloVisualizacao[];
}

export interface ProtocoloFisico {
  id: string;
  descricao: string;
  retiradoPor: string | null;
  data: string;
  status: 'AGUARDANDO_RETIRADA' | 'ENTREGUE' | 'DEVOLVIDO' | 'CANCELADO';
  assinaturaPath: string | null;
  empresa?: { razaoSocial: string };
}

export const STATUS_FISICO_LABEL: Record<ProtocoloFisico['status'], string> = {
  AGUARDANDO_RETIRADA: 'Aguardando retirada',
  ENTREGUE: 'Entregue',
  DEVOLVIDO: 'Devolvido',
  CANCELADO: 'Cancelado',
};

// ---------- Modulo 5 (Robo) ----------
export type StatusRoboJob = 'PROCESSANDO' | 'BAIXADO' | 'REVISAO' | 'ERRO' | 'IGNORADO';

export interface RoboJob {
  id: string;
  arquivoNome: string;
  paginaIndex: number | null;
  origem: string;
  status: StatusRoboJob;
  motivo: string | null;
  empresaId: string | null;
  empresaNome: string | null;
  obrigacaoNome: string | null;
  competenciaAno: number | null;
  competenciaMes: number | null;
  etapas: { etapa: string; ok: boolean; ms: number; detalhe?: string }[];
  textoTrecho: string | null;
  createdAt: string;
}

export interface AssinaturaDocumento {
  id: string;
  nome: string;
  obrigacaoNome: string;
  palavras: string[];
  regexCompetencia: string | null;
  regexVencimento: string | null;
  ativo: boolean;
}

export interface RoboPainel {
  processadosHoje: number;
  processadosMes: number;
  baixadosMes: number;
  pendentesRevisao: number;
  taxaMatch: number;
}

export const STATUS_ROBO_INFO: Record<StatusRoboJob, { label: string; cor: string }> = {
  PROCESSANDO: { label: 'Processando', cor: '#5b9bd5' },
  BAIXADO: { label: 'Baixado', cor: '#5cb85c' },
  REVISAO: { label: 'Revisao', cor: '#f0ad4e' },
  ERRO: { label: 'Erro', cor: '#cf3c5d' },
  IGNORADO: { label: 'Ignorado', cor: '#94a3b8' },
};

// ---------- Modulo 6 (Processos) ----------
export type StatusProcesso = 'EM_ANDAMENTO' | 'SUSPENSO' | 'CONCLUIDO' | 'CANCELADO';
export type StatusPasso = 'PENDENTE' | 'CONCLUIDO' | 'DISPENSADO';
export type AcaoAutomatica = 'NENHUMA' | 'CRIAR_TAREFA' | 'CRIAR_OBRIGACAO_NA_EMPRESA' | 'INICIAR_SUBPROCESSO';

export const STATUS_PROCESSO_INFO: Record<StatusProcesso, { label: string; cor: string }> = {
  EM_ANDAMENTO: { label: 'Em andamento', cor: '#5b9bd5' },
  SUSPENSO: { label: 'Suspenso', cor: '#f0ad4e' },
  CONCLUIDO: { label: 'Concluido', cor: '#5cb85c' },
  CANCELADO: { label: 'Cancelado', cor: '#94a3b8' },
};

export interface MatrizPasso {
  id?: string;
  ordem: number;
  titulo: string;
  descricao?: string | null;
  departamentoId?: string | null;
  prazoDias: number;
  basePrazo: 'INICIO' | 'PASSO_ANTERIOR';
  bloqueante: boolean;
  acaoAutomatica: AcaoAutomatica;
  acaoRef?: string | null;
}
export interface Matriz {
  id: string;
  nome: string;
  departamentoId: string | null;
  descricao: string | null;
  ativo: boolean;
  passos: MatrizPasso[];
  _count?: { processos: number };
}

export interface ProcessoLista {
  id: string;
  nome: string;
  status: StatusProcesso;
  dataInicio: string;
  suspensoAte: string | null;
  empresa: { razaoSocial: string } | null;
  matriz: { nome: string } | null;
  progresso: number;
  totalPassos: number;
  passosConcluidos: number;
}

export interface ProcessoPasso {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  departamentoId: string | null;
  bloqueante: boolean;
  status: StatusPasso;
  prazo: string | null;
  concluidoEm: string | null;
  acaoAutomatica: AcaoAutomatica;
  acaoRef: string | null;
}
export interface ProcessoDetalhe {
  id: string;
  nome: string;
  status: StatusProcesso;
  dataInicio: string;
  suspensoAte: string | null;
  empresa: { id: string; razaoSocial: string };
  matriz: { nome: string } | null;
  passos: ProcessoPasso[];
  comentarios: { id: string; texto: string; createdAt: string }[];
}

// ---------- Modulo 8 (Comunicacao) ----------
export interface TemplateEmail {
  id: string;
  tipo: 'ENTREGA' | 'LEMBRETE' | 'COMUNICADO' | 'GENERICO';
  nome: string;
  assunto: string;
  corpo: string;
  ativo: boolean;
}
export interface ComunicacaoLogItem {
  id: string;
  canal: 'EMAIL' | 'WHATSAPP';
  destinatario: string;
  assunto: string | null;
  status: 'FILA' | 'ENVIADO' | 'FALHOU' | 'LIDO' | 'INTENCAO';
  tentativas: number;
  createdAt: string;
  erro: string | null;
}
export interface ChatbotFluxo {
  id: string;
  nome: string;
  arvore: ChatbotNo;
  ativo: boolean;
}
export interface ChatbotNo {
  pergunta: string;
  opcoes: { texto: string; resposta?: string; proximo?: ChatbotNo }[];
}

export const STATUS_COM_INFO: Record<string, { label: string; cor: string }> = {
  FILA: { label: 'Na fila', cor: '#94a3b8' },
  ENVIADO: { label: 'Enviado', cor: '#5cb85c' },
  FALHOU: { label: 'Falhou', cor: '#cf3c5d' },
  LIDO: { label: 'Lido', cor: '#3a9d3a' },
  INTENCAO: { label: 'Intencao (WhatsApp)', cor: '#5b9bd5' },
};

export function dataBR(d: string | Date): string {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatarIdent(tipo: TipoIdentificador, valor: string): string {
  if (tipo === 'CNPJ' && valor.length === 14)
    return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (tipo === 'CPF' && valor.length === 11)
    return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return valor;
}

export function formatarBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
