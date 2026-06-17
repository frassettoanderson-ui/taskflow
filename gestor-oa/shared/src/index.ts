// ============================================================
// @gestoroa/shared - tipos e constantes compartilhados server/web
// ============================================================

// ---------- Resposta padrao da API ----------
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiFail {
  ok: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiOk<T> | ApiFail;

// ---------- Paginacao ----------
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export const PAGINATION_MAX_LIMIT = 100;
export const PAGINATION_DEFAULT_LIMIT = 25;

// ---------- Enums de dominio (espelham o schema Prisma) ----------
export const TipoIdentificador = {
  CNPJ: 'CNPJ',
  CPF: 'CPF',
  INSCRICAO_ESTADUAL: 'INSCRICAO_ESTADUAL',
  CEI: 'CEI',
  CAEPF: 'CAEPF',
} as const;
export type TipoIdentificador =
  (typeof TipoIdentificador)[keyof typeof TipoIdentificador];

export const Periodicidade = {
  MENSAL: 'MENSAL',
  TRIMESTRAL: 'TRIMESTRAL',
  ANUAL: 'ANUAL',
  EVENTUAL: 'EVENTUAL',
} as const;
export type Periodicidade = (typeof Periodicidade)[keyof typeof Periodicidade];

export const StatusEntrega = {
  PENDENTE: 'PENDENTE',
  PENDENTE_ANTECIPADO: 'PENDENTE_ANTECIPADO',
  EM_ATRASO_TECNICO: 'EM_ATRASO_TECNICO',
  EM_ATRASO_LEGAL: 'EM_ATRASO_LEGAL',
  ENTREGUE: 'ENTREGUE',
  ENTREGUE_JUSTIFICADA: 'ENTREGUE_JUSTIFICADA',
  DISPENSADA: 'DISPENSADA',
} as const;
export type StatusEntrega = (typeof StatusEntrega)[keyof typeof StatusEntrega];

export const OrigemObrigacao = {
  REGIME: 'REGIME',
  GRUPO: 'GRUPO',
  MANUAL: 'MANUAL',
} as const;
export type OrigemObrigacao =
  (typeof OrigemObrigacao)[keyof typeof OrigemObrigacao];

// Regra de prazo de uma obrigacao (JSON em Obrigacao.regraPrazo)
export interface RegraPrazo {
  // DIA_FIXO: dia do mes (ex.: 20). DIA_UTIL: N-esimo dia util (ex.: 5).
  tipoDia: 'DIA_FIXO' | 'DIA_UTIL';
  dia: number;
  // o que fazer se o prazo cair em dia nao-util
  regraNaoUtil: 'ANTECIPA' | 'POSTERGA' | 'MANTEM';
  // sabado conta como dia util? (sobrescreve o padrao do escritorio)
  sabadoEhUtil?: boolean;
  // antecedencia do prazo tecnico em relacao ao legal
  diasAntesTecnico: number;
  tipoDiasAntes: 'CORRIDOS' | 'UTEIS';
}

// Uma origem do vinculo empresa x obrigacao
export interface OrigemVinculo {
  origem: OrigemObrigacao;
  refId?: string; // id do regime ou grupo (vazio para MANUAL)
}

export const OrigemBaixa = {
  MANUAL: 'MANUAL',
  ROBO: 'ROBO',
} as const;
export type OrigemBaixa = (typeof OrigemBaixa)[keyof typeof OrigemBaixa];

// ---------- Permissoes (RBAC granular por flags) ----------
// Lista canonica das flags de permissao do Modulo 4.
export const PERMISSION_FLAGS = [
  'empresas_ver',
  'empresas_criar',
  'empresas_editar',
  'empresas_excluir',
  'empresas_importar',
  'obrigacoes_ver',
  'obrigacoes_gerenciar',
  'entregas_ver',
  'entregas_baixar',
  'entregas_editar_prazos',
  'entregas_acoes_massa',
  'entregas_desfazer_robo',
  'entregas_dispensar',
  'processos_ver',
  'processos_gerenciar_matrizes',
  'processos_operar',
  'documentos_ver',
  'documentos_upload',
  'documentos_excluir',
  'relatorios_ver',
  'apla_ver',
  'apla_configurar',
  'portal_comunicados',
  'portal_solicitacoes',
  'portal_configurar',
  'admin_usuarios',
  'admin_permissoes',
  'admin_auditoria',
  'admin_escritorio',
] as const;
export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

// ---------- Auth ----------
export interface JanelaAcesso {
  diaSemana: number; // 0=domingo ... 6=sabado
  inicio: string; // "HH:mm"
  fim: string; // "HH:mm"
}

export interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  permissoes: Record<PermissionFlag, boolean>;
}

export interface EscritorioPublico {
  id: string;
  nome: string;
  cnpj: string | null;
  logoUrl: string | null;
}

export interface SessaoAtual {
  usuario: UsuarioPublico;
  escritorio: EscritorioPublico;
  accessToken: string;
}
