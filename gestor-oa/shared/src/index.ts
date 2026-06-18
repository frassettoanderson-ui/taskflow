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
  'solicitacoes_internas_ver',
  'solicitacoes_internas_gerenciar',
  'admin_usuarios',
  'admin_permissoes',
  'admin_auditoria',
  'admin_escritorio',
] as const;
export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

// ---------- Permissoes por NIVEL (estilo Acessorias) ----------
// Cada area e' um dropdown com niveis; os niveis sao traduzidos para as flags
// booleanas acima (que o backend usa em requirePermission). Fonte unica da verdade.
export interface AreaNivel { v: number; label: string }
export interface PermissionArea { id: string; label: string; niveis: AreaNivel[] }

export const PERMISSION_AREAS: PermissionArea[] = [
  { id: 'empresas', label: 'Cadastro de Empresas', niveis: [
    { v: 0, label: 'Nao = Acesso bloqueado' }, { v: 1, label: 'Visualizar' }, { v: 2, label: 'Visualizar e editar' }, { v: 3, label: 'Total (incl. excluir/importar)' } ] },
  { id: 'obrigacoes', label: 'Cadastro de Obrigacoes / Regimes e Grupos', niveis: [
    { v: 0, label: 'Nenhum acesso' }, { v: 1, label: 'Visualizar' }, { v: 2, label: 'Gerenciar' } ] },
  { id: 'entregas_ver', label: 'Demandas da Lista de Entregas e Solicitacoes', niveis: [
    { v: 0, label: 'Sem permissao' }, { v: 1, label: 'Visualizar' } ] },
  { id: 'entregas_baixar', label: 'Pode dar baixa?', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Sim' }] },
  { id: 'entregas_dispensar', label: 'Pode dispensar demandas na Lista de Entregas?', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Sim' }] },
  { id: 'entregas_prazos', label: 'Pode alterar prazos tecnicos/legais?', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Sim' }] },
  { id: 'entregas_massa', label: 'Acoes em massa nas entregas?', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Sim' }] },
  { id: 'entregas_desfazer_robo', label: 'Desfazer baixa do robo?', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Sim' }] },
  { id: 'processos', label: 'Gestao de processos', niveis: [
    { v: 0, label: 'Acesso bloqueado' }, { v: 1, label: 'Visualizar' }, { v: 2, label: 'Operar' }, { v: 3, label: 'Total (incl. matrizes)' } ] },
  { id: 'documentos', label: 'AC Docs / Documentos (GED)', niveis: [
    { v: 0, label: 'Acesso bloqueado' }, { v: 1, label: 'Visualizar' }, { v: 2, label: 'Visualizar e enviar' } ] },
  { id: 'anexos_apagar', label: 'Pode apagar anexos (arquivos)?', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Sim' }] },
  { id: 'relatorios', label: 'Relatorios', niveis: [{ v: 0, label: 'Sem permissao' }, { v: 1, label: 'Ver relatorios e insights' }] },
  { id: 'apla', label: 'Permissoes do APLA', niveis: [
    { v: 0, label: 'Sem permissao' }, { v: 1, label: 'Ver relatorios' }, { v: 2, label: 'Configurar' } ] },
  { id: 'portal_config', label: 'Configuracoes Area VIP e App', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Sim' }] },
  { id: 'comunicados', label: 'Comunicados', niveis: [{ v: 0, label: 'Sem permissao' }, { v: 1, label: 'Gerenciar' }] },
  { id: 'portal_solic', label: 'Solicitacoes (clientes)', niveis: [{ v: 0, label: 'Sem permissao' }, { v: 1, label: 'Gerenciar' }] },
  { id: 'solic_internas', label: 'Solicitacoes internas', niveis: [
    { v: 0, label: 'Sem permissao' }, { v: 1, label: 'Ver e participar' }, { v: 2, label: 'Gerenciar (atribuir/excluir)' } ] },
  { id: 'usuarios', label: 'Controle de Usuarios', niveis: [
    { v: 0, label: 'Acesso bloqueado' }, { v: 1, label: 'Gerenciar usuarios' }, { v: 2, label: 'Usuarios e permissoes' } ] },
  { id: 'sistema', label: 'Configuracoes do Sistema e do e-Continuo', niveis: [{ v: 0, label: 'Sem permissao' }, { v: 1, label: 'Sim' }] },
  { id: 'auditoria', label: 'Auditoria', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Ver auditoria' }] },
];

export type PermissionNiveis = Record<string, number>;

// Traduz os niveis escolhidos para as flags booleanas usadas pelo backend.
export function nivelParaFlags(niveis: PermissionNiveis): Record<PermissionFlag, boolean> {
  const f = Object.fromEntries(PERMISSION_FLAGS.map((x) => [x, false])) as Record<PermissionFlag, boolean>;
  const n = (id: string) => niveis[id] ?? 0;
  if (n('empresas') >= 1) f.empresas_ver = true;
  if (n('empresas') >= 2) { f.empresas_criar = true; f.empresas_editar = true; f.empresas_importar = true; }
  if (n('empresas') >= 3) f.empresas_excluir = true;
  if (n('obrigacoes') >= 1) f.obrigacoes_ver = true;
  if (n('obrigacoes') >= 2) f.obrigacoes_gerenciar = true;
  if (n('entregas_ver') >= 1) f.entregas_ver = true;
  if (n('entregas_baixar') >= 1) f.entregas_baixar = true;
  if (n('entregas_dispensar') >= 1) f.entregas_dispensar = true;
  if (n('entregas_prazos') >= 1) f.entregas_editar_prazos = true;
  if (n('entregas_massa') >= 1) f.entregas_acoes_massa = true;
  if (n('entregas_desfazer_robo') >= 1) f.entregas_desfazer_robo = true;
  if (n('processos') >= 1) f.processos_ver = true;
  if (n('processos') >= 2) f.processos_operar = true;
  if (n('processos') >= 3) f.processos_gerenciar_matrizes = true;
  if (n('documentos') >= 1) f.documentos_ver = true;
  if (n('documentos') >= 2) f.documentos_upload = true;
  if (n('anexos_apagar') >= 1) f.documentos_excluir = true;
  if (n('relatorios') >= 1) f.relatorios_ver = true;
  if (n('apla') >= 1) f.apla_ver = true;
  if (n('apla') >= 2) f.apla_configurar = true;
  if (n('portal_config') >= 1) f.portal_configurar = true;
  if (n('comunicados') >= 1) f.portal_comunicados = true;
  if (n('portal_solic') >= 1) f.portal_solicitacoes = true;
  if (n('solic_internas') >= 1) f.solicitacoes_internas_ver = true;
  if (n('solic_internas') >= 2) f.solicitacoes_internas_gerenciar = true;
  if (n('usuarios') >= 1) f.admin_usuarios = true;
  if (n('usuarios') >= 2) f.admin_permissoes = true;
  if (n('sistema') >= 1) f.admin_escritorio = true;
  if (n('auditoria') >= 1) f.admin_auditoria = true;
  return f;
}

// Deriva os niveis a partir das flags (p/ exibir usuarios antigos sem niveis salvos).
export function flagsParaNiveis(flags: Partial<Record<PermissionFlag, boolean>>): PermissionNiveis {
  const b = (k: PermissionFlag) => !!flags[k];
  return {
    empresas: b('empresas_excluir') ? 3 : (b('empresas_criar') || b('empresas_editar')) ? 2 : b('empresas_ver') ? 1 : 0,
    obrigacoes: b('obrigacoes_gerenciar') ? 2 : b('obrigacoes_ver') ? 1 : 0,
    entregas_ver: b('entregas_ver') ? 1 : 0,
    entregas_baixar: b('entregas_baixar') ? 1 : 0,
    entregas_dispensar: b('entregas_dispensar') ? 1 : 0,
    entregas_prazos: b('entregas_editar_prazos') ? 1 : 0,
    entregas_massa: b('entregas_acoes_massa') ? 1 : 0,
    entregas_desfazer_robo: b('entregas_desfazer_robo') ? 1 : 0,
    processos: b('processos_gerenciar_matrizes') ? 3 : b('processos_operar') ? 2 : b('processos_ver') ? 1 : 0,
    documentos: b('documentos_upload') ? 2 : b('documentos_ver') ? 1 : 0,
    anexos_apagar: b('documentos_excluir') ? 1 : 0,
    relatorios: b('relatorios_ver') ? 1 : 0,
    apla: b('apla_configurar') ? 2 : b('apla_ver') ? 1 : 0,
    portal_config: b('portal_configurar') ? 1 : 0,
    comunicados: b('portal_comunicados') ? 1 : 0,
    portal_solic: b('portal_solicitacoes') ? 1 : 0,
    solic_internas: b('solicitacoes_internas_gerenciar') ? 2 : b('solicitacoes_internas_ver') ? 1 : 0,
    usuarios: b('admin_permissoes') ? 2 : b('admin_usuarios') ? 1 : 0,
    sistema: b('admin_escritorio') ? 1 : 0,
    auditoria: b('admin_auditoria') ? 1 : 0,
  };
}

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
