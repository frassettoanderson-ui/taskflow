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
