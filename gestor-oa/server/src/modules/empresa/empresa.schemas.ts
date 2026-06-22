import { z } from 'zod';

export const tipoIdentificadorEnum = z.enum([
  'CNPJ',
  'CPF',
  'INSCRICAO_ESTADUAL',
  'CEI',
  'CAEPF',
]);

export const identificadorInput = z.object({
  tipo: tipoIdentificadorEnum,
  valor: z.string().min(1, 'Informe o valor do identificador.'),
  apelido: z.string().optional().nullable(),
});

export const criarEmpresaSchema = z.object({
  razaoSocial: z.string().min(2, 'Razao social e obrigatoria.'),
  nomeFantasia: z.string().optional().nullable(),
  numero: z.number().int().min(0).max(99999).optional().nullable(),
  honorario: z.number().min(0).optional().nullable(),
  apelidoEcontinuo: z.string().optional().nullable(),
  grupoEmpresaId: z.string().optional().nullable(),
  emailPrincipal: z.string().email('E-mail invalido.').optional().nullable().or(z.literal('')),
  telefone: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numeroEndereco: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable().or(z.literal('')),
  grupoEnvio: z.string().optional().nullable(),
  nire: z.string().optional().nullable(),
  inscricaoMunicipal: z.string().optional().nullable(),
  inscMunicipalData: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  ieIsenta: z.boolean().optional(),
  inscricoesEstaduais: z.array(z.object({ valor: z.string(), data: z.string().optional().nullable(), uf: z.string().optional().nullable() })).optional().nullable(),
  dataAbertura: z.string().datetime().optional().nullable().or(z.literal('')),
  regimeTributarioId: z.string().optional().nullable(),
  anotacoes: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  dataEntrada: z.string().datetime().optional().nullable().or(z.literal('')),
  dataSaida: z.string().datetime().optional().nullable().or(z.literal('')),
  tagIds: z.array(z.string()).optional(),
  identificadores: z.array(identificadorInput).optional(),
});

export const editarEmpresaSchema = criarEmpresaSchema.partial();

export const contatoSchema = z.object({
  nome: z.string().min(2, 'Nome do contato e obrigatorio.'),
  email: z.string().email('E-mail invalido.').optional().nullable().or(z.literal('')),
  whatsapp: z.string().optional().nullable(),
  cargo: z.string().optional().nullable(),
  departamentoIds: z.array(z.string()).optional(),
  obrigacaoIds: z.array(z.string()).optional(),
  ativo: z.boolean().optional(),
});

export const comentarioSchema = z.object({
  texto: z.string().min(1, 'Comentario vazio.'),
  departamentoId: z.string().optional().nullable(),
});

export const responsavelSchema = z.object({
  departamentoId: z.string().min(1),
  usuarioId: z.string().min(1),
});

// Acoes em massa
export const acaoMassaSchema = z.object({
  empresaIds: z.array(z.string()).min(1, 'Selecione ao menos uma empresa.'),
  acao: z.enum(['aplicar_tags', 'alterar_responsavel', 'inativar', 'ativar']),
  // aplicar_tags
  tagIds: z.array(z.string()).optional(),
  // alterar_responsavel
  departamentoId: z.string().optional(),
  usuarioId: z.string().optional(),
});

// Importacao CSV - confirmacao
export const importarCsvSchema = z.object({
  // linhas ja mapeadas no front: cada item vira uma empresa
  linhas: z
    .array(
      z.object({
        razaoSocial: z.string().min(1),
        nomeFantasia: z.string().optional(),
        emailPrincipal: z.string().optional(),
        telefone: z.string().optional(),
        endereco: z.string().optional(),
        chaveTipo: tipoIdentificadorEnum.optional(),
        chaveValor: z.string().optional(),
      }),
    )
    .min(1, 'Nenhuma linha para importar.'),
});

export const tarefaSchema = z.object({
  titulo: z.string().min(1, 'Informe o titulo da tarefa.'),
  descricao: z.string().optional().nullable(),
  dataHora: z.string().min(1, 'Informe a data/hora.'),
});

export const inativarAssistidoSchema = z.object({
  motivoCancelamentoId: z.string().optional().nullable(),
  dataSaida: z.string().optional().nullable().or(z.literal('')),
  dispensarPendentes: z.boolean().optional(),
  observacao: z.string().optional().nullable(),
});

export const listarEmpresasQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  busca: z.string().optional(),
  tagId: z.string().optional(),
  regimeId: z.string().optional(),
  departamentoId: z.string().optional(),
  status: z.enum(['ativos', 'inativos', 'todos']).optional(),
});
