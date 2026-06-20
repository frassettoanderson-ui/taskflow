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
  'admin_transferir_resp',
  'admin_auditoria',
  'admin_escritorio',
] as const;
export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

// ---------- Permissoes por NIVEL (estilo Acessorias) ----------
// Cada area e' um dropdown com niveis; os niveis sao traduzidos para as flags
// booleanas acima (que o backend usa em requirePermission). Fonte unica da verdade.
export interface AreaNivel { v: number; label: string }

// `extra: true` = recurso nosso (nao existe no Acessorias). `semEfeito: true` =
// area do Acessorias que ainda nao tem funcao aqui (guarda o nivel, sem efeito).
export interface PermissionArea { id: string; label: string; niveis: AreaNivel[]; extra?: boolean; semEfeito?: boolean }

const SIM_NAO: AreaNivel[] = [{ v: 0, label: 'Nao' }, { v: 1, label: 'Sim' }];
const ACESSO: AreaNivel[] = [{ v: 0, label: 'Nao = Acesso bloqueado' }, { v: 1, label: 'Sim = Acesso permitido' }];

export const PERMISSION_AREAS: PermissionArea[] = [
  { id: 'administrativo', label: 'Administrativo?', niveis: SIM_NAO },
  { id: 'sistema', label: 'Configuracoes do Sistema e do e-Continuo', niveis: [
    { v: 0, label: 'Nao = Sem permissao' }, { v: 1, label: 'Sim = Acesso permitido' } ] },
  { id: 'usuarios', label: 'Controle de Usuarios', niveis: [
    { v: 0, label: '[0] = Acesso bloqueado' },
    { v: 1, label: '[1] = Relacao, Cadastro e Permissoes' },
    { v: 2, label: '[2] = [1] + Transf. resp. departamentos' } ] },
  { id: 'departamentos', label: 'Cadastro de departamentos', niveis: [
    { v: 0, label: '[0] = Acesso bloqueado' },
    { v: 1, label: '[1] = Visualizar e disparar e-mails agendados' },
    { v: 2, label: '[2] = [1] + Cadastro/Edicao de dptos' },
    { v: 3, label: '[3] = [2] + Definir gestores dos dptos' } ] },
  { id: 'obrigacoes', label: 'Cadastro de Obrigacoes', niveis: [
    { v: 0, label: '[0] = Nenhum acesso' },
    { v: 1, label: '[1] = Listagem' },
    { v: 2, label: '[2] = [1] + Alocar obrigacoes em empresas' },
    { v: 3, label: '[3] = [2] + Retroativa e avulsa' },
    { v: 4, label: '[4] = [3] + Adicionar/Editar cadastros' } ] },
  { id: 'regimes_grupos', label: 'Regimes e Grupos de obrigacoes', niveis: ACESSO },
  { id: 'empresas', label: 'Cadastro de Empresas', niveis: [
    { v: 0, label: '[0] = Acesso bloqueado' },
    { v: 1, label: '[1] = Visualizar empresas' },
    { v: 2, label: '[2] = [1] + Editar cadastros' },
    { v: 3, label: '[3] = [2] + Criar / Importar' },
    { v: 4, label: '[4] = [3] + Excluir empresas' } ] },
  { id: 'anexos_apagar', label: 'Pode apagar anexos (arquivos)?', niveis: [
    { v: 0, label: 'Nao = Sem permissao' }, { v: 1, label: 'Sim = Exclusoes permitidas' } ] },
  { id: 'processos', label: 'Gestao de processos', niveis: ACESSO },
  { id: 'entregas_dispensar', label: 'Pode dispensar demandas na Lista de Entregas?', niveis: [
    { v: 0, label: 'Nao' },
    { v: 1, label: 'Sim, mas exigir justificativa' },
    { v: 2, label: 'Sim, inclusive em massa (diversas de uma vez)' } ] },
  { id: 'entregas', label: 'Demandas da Lista de Entregas e Solicitacoes', niveis: [
    { v: 1, label: '[1] = Visualizar somente as proprias' },
    { v: 2, label: '[2] = [1] + das emp. que e resp. por algum dpto' },
    { v: 3, label: '[3] = Pode visualizar todas' } ] },
  { id: 'entregas_prazos', label: 'Pode alterar prazos tecnicos/legais?', niveis: SIM_NAO },
  { id: 'apla', label: 'Permissoes do APLA', niveis: [
    { v: 0, label: 'Sem permissao' }, { v: 1, label: 'Sim, pode alterar' } ] },
  { id: 'tempo_previsto', label: 'Tempo previsto das demandas', niveis: [
    { v: 0, label: 'Sem permissao' }, { v: 1, label: 'Sim, pode alterar' } ], semEfeito: true },
  { id: 'salarios', label: 'Salarios e Honorarios', niveis: [
    { v: 0, label: 'Sem permissao' }, { v: 1, label: 'Sim, pode visualizar / alterar' } ], semEfeito: true },
  { id: 'portal_config', label: 'Configuracoes Area VIP e App', niveis: SIM_NAO },
  { id: 'comunicados', label: 'Comunicados', niveis: [
    { v: 0, label: '[0] = Sem permissao' },
    { v: 1, label: '[1] = Visualizacao' },
    { v: 2, label: '[2] = [1] + Criacao / Edicao' } ] },
  { id: 'portal_solic', label: 'Solicitacoes', niveis: [
    { v: 0, label: '[0] = Sem permissao' },
    { v: 1, label: '[1] = Listagem / Interacao' },
    { v: 2, label: '[2] = [1] + Criacao' } ] },
  { id: 'certificado', label: 'Certificado digital', niveis: SIM_NAO, semEfeito: true },
  { id: 'documentos', label: 'AC Docs', niveis: ACESSO },
  // Extras nossos (nao existem no Acessorias)
  { id: 'relatorios', label: 'Relatorios', niveis: [{ v: 0, label: 'Sem permissao' }, { v: 1, label: 'Ver relatorios e insights' }], extra: true },
  { id: 'solic_internas', label: 'Solicitacoes internas', niveis: [
    { v: 0, label: 'Sem permissao' }, { v: 1, label: 'Ver e participar' }, { v: 2, label: 'Gerenciar (atribuir/excluir)' } ], extra: true },
  { id: 'auditoria', label: 'Auditoria', niveis: [{ v: 0, label: 'Nao' }, { v: 1, label: 'Ver auditoria' }], extra: true },
];

export type PermissionNiveis = Record<string, number>;

// Traduz os niveis escolhidos para as flags booleanas usadas pelo backend.
export function nivelParaFlags(niveis: PermissionNiveis): Record<PermissionFlag, boolean> {
  const f = Object.fromEntries(PERMISSION_FLAGS.map((x) => [x, false])) as Record<PermissionFlag, boolean>;
  const n = (id: string) => niveis[id] ?? 0;
  // Administrativo = acesso total
  if (n('administrativo') >= 1) { for (const k of PERMISSION_FLAGS) f[k] = true; return f; }
  // Empresas (escala 0..4: ver / +editar / +criar/importar / +excluir)
  const nemp = n('empresas');
  if (nemp >= 1) f.empresas_ver = true;
  if (nemp >= 2) f.empresas_editar = true;
  if (nemp >= 3) { f.empresas_criar = true; f.empresas_importar = true; }
  if (nemp >= 4) f.empresas_excluir = true;
  // Obrigacoes (escala 0..4)
  if (n('obrigacoes') >= 1) f.obrigacoes_ver = true;
  if (n('obrigacoes') >= 2) f.obrigacoes_gerenciar = true;
  if (n('regimes_grupos') >= 1) { f.obrigacoes_ver = true; f.obrigacoes_gerenciar = true; }
  // Lista de entregas (todos veem ao menos as proprias; escala 1..3)
  const ne = niveis.entregas ?? 1;
  if (ne >= 1) { f.entregas_ver = true; f.entregas_baixar = true; }
  if (ne >= 3) { f.entregas_acoes_massa = true; f.entregas_desfazer_robo = true; }
  if (n('entregas_dispensar') >= 1) f.entregas_dispensar = true;
  if (n('entregas_dispensar') >= 2) f.entregas_acoes_massa = true;
  if (n('entregas_prazos') >= 1) f.entregas_editar_prazos = true;
  // Processos (Sim = total)
  if (n('processos') >= 1) { f.processos_ver = f.processos_operar = f.processos_gerenciar_matrizes = true; }
  // AC Docs / apagar anexos
  if (n('documentos') >= 1) { f.documentos_ver = true; f.documentos_upload = true; }
  if (n('anexos_apagar') >= 1) f.documentos_excluir = true;
  // APLA (Sim = pode alterar)
  if (n('apla') >= 1) { f.apla_ver = true; f.apla_configurar = true; }
  // Portal / Area VIP
  if (n('portal_config') >= 1) f.portal_configurar = true;
  if (n('comunicados') >= 1) f.portal_comunicados = true;
  if (n('portal_solic') >= 1) f.portal_solicitacoes = true;
  // Usuarios (nivel 1 ja inclui permissoes; nivel 2 = transf. responsabilidade)
  if (n('usuarios') >= 1) { f.admin_usuarios = true; f.admin_permissoes = true; }
  if (n('usuarios') >= 2) f.admin_transferir_resp = true;
  // Sistema / Departamentos -> config do escritorio
  if (n('sistema') >= 1) f.admin_escritorio = true;
  if (n('departamentos') >= 2) f.admin_escritorio = true;
  // Extras nossos (nao existem no Acessorias)
  if (n('relatorios') >= 1) f.relatorios_ver = true;
  if (n('solic_internas') >= 1) f.solicitacoes_internas_ver = true;
  if (n('solic_internas') >= 2) f.solicitacoes_internas_gerenciar = true;
  if (n('auditoria') >= 1) f.admin_auditoria = true;
  return f;
}

// Deriva os niveis a partir das flags (p/ exibir usuarios antigos sem niveis salvos).
export function flagsParaNiveis(flags: Partial<Record<PermissionFlag, boolean>>): PermissionNiveis {
  const b = (k: PermissionFlag) => !!flags[k];
  const adminTotal = b('admin_usuarios') && b('admin_permissoes') && b('admin_escritorio') && b('admin_auditoria') && b('empresas_excluir');
  return {
    administrativo: adminTotal ? 1 : 0,
    sistema: b('admin_escritorio') ? 1 : 0,
    usuarios: b('admin_transferir_resp') ? 2 : (b('admin_permissoes') || b('admin_usuarios')) ? 1 : 0,
    departamentos: b('admin_escritorio') ? 1 : 0,
    obrigacoes: b('obrigacoes_gerenciar') ? 2 : b('obrigacoes_ver') ? 1 : 0,
    regimes_grupos: b('obrigacoes_gerenciar') ? 1 : 0,
    empresas: b('empresas_excluir') ? 4 : (b('empresas_criar') || b('empresas_importar')) ? 3 : b('empresas_editar') ? 2 : b('empresas_ver') ? 1 : 0,
    anexos_apagar: b('documentos_excluir') ? 1 : 0,
    processos: b('processos_gerenciar_matrizes') ? 3 : b('processos_operar') ? 2 : b('processos_ver') ? 1 : 0,
    entregas_dispensar: b('entregas_dispensar') ? 1 : 0,
    entregas: b('entregas_baixar') ? 3 : b('entregas_ver') ? 2 : 0,
    entregas_prazos: b('entregas_editar_prazos') ? 1 : 0,
    apla: b('apla_configurar') ? 2 : b('apla_ver') ? 1 : 0,
    portal_config: b('portal_configurar') ? 1 : 0,
    comunicados: b('portal_comunicados') ? 1 : 0,
    portal_solic: b('portal_solicitacoes') ? 1 : 0,
    documentos: b('documentos_upload') ? 2 : b('documentos_ver') ? 1 : 0,
    relatorios: b('relatorios_ver') ? 1 : 0,
    solic_internas: b('solicitacoes_internas_gerenciar') ? 2 : b('solicitacoes_internas_ver') ? 1 : 0,
    auditoria: b('admin_auditoria') ? 1 : 0,
  };
}

// ---------- Presets de permissao por cargo ----------
// Aplicar um preset substitui todos os niveis. Areas omitidas voltam ao nivel 0.
export interface PermissionPreset { id: string; label: string; descricao: string; niveis: PermissionNiveis }
export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: 'admin', label: 'Administrador',
    descricao: 'Acesso total a todas as areas do sistema.',
    niveis: { administrativo: 1 },
  },
  {
    id: 'gerente', label: 'Gerente / Supervisor',
    descricao: 'Gerencia obrigacoes, empresas, processos e equipe (sem ser administrativo total).',
    niveis: {
      sistema: 1, usuarios: 2, departamentos: 3, obrigacoes: 4, regimes_grupos: 1,
      empresas: 3, anexos_apagar: 1, processos: 1, entregas_dispensar: 2, entregas: 3,
      entregas_prazos: 1, apla: 1, portal_config: 1, comunicados: 2, portal_solic: 2,
      documentos: 1, relatorios: 1, solic_internas: 2, auditoria: 1,
    },
  },
  {
    id: 'operacional', label: 'Colaborador / Operacional',
    descricao: 'Opera a Lista de Entregas e processos; visualiza empresas e obrigacoes.',
    niveis: {
      obrigacoes: 1, empresas: 1, processos: 1, entregas_dispensar: 1, entregas: 2,
      documentos: 1, comunicados: 1, portal_solic: 1, relatorios: 1, solic_internas: 1,
    },
  },
  {
    id: 'leitura', label: 'Somente leitura',
    descricao: 'Apenas visualiza empresas, obrigacoes, documentos e relatorios.',
    niveis: { obrigacoes: 1, empresas: 1, entregas: 1, documentos: 1, comunicados: 1, relatorios: 1 },
  },
];

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
