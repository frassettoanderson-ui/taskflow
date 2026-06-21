import { z } from 'zod';

export const regraPrazoSchema = z.object({
  tipoDia: z.enum(['DIA_FIXO', 'DIA_UTIL']),
  dia: z.number().int().min(1).max(31),
  regraNaoUtil: z.enum(['ANTECIPA', 'POSTERGA', 'MANTEM']).default('ANTECIPA'),
  sabadoEhUtil: z.boolean().optional(),
  diasAntesTecnico: z.number().int().min(0).default(0),
  tipoDiasAntes: z.enum(['CORRIDOS', 'UTEIS']).default('CORRIDOS'),
});

export const entregaMesSchema = z.object({
  modo: z.enum(['NAO_ENTREGA', 'DIA_FIXO', 'DIA_UTIL', 'ULT_DIA_UTIL']),
  dia: z.number().int().min(1).max(31).optional().nullable(),
});

export const obrigacaoSchema = z.object({
  nome: z.string().min(2, 'Nome da obrigacao e obrigatorio.'),
  mininome: z.string().optional().nullable(),
  departamentoId: z.string().optional().nullable(),
  responsavelId: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  periodicidade: z.enum(['MENSAL', 'TRIMESTRAL', 'ANUAL', 'EVENTUAL']).default('MENSAL'),
  regraPrazo: regraPrazoSchema,
  entregaMeses: z.array(entregaMesSchema).optional(),
  tempoPrevistoMin: z.number().int().min(0).default(0),
  lembrarDiasAntes: z.number().int().min(0).default(5),
  competenciaRef: z.enum(['MES_ATUAL', 'MES_ANTERIOR', 'ANO_ATUAL', 'ANO_ANTERIOR']).default('MES_ANTERIOR'),
  exigeAnexoNaBaixa: z.boolean().default(false),
  exigeBaixaPeloRobo: z.boolean().default(false),
  passivelMulta: z.boolean().default(false),
  alertaNaoLida: z.boolean().default(true),
  comentarioPadrao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export const regimeSchema = z.object({
  nome: z.string().min(2, 'Nome do regime e obrigatorio.'),
  ativo: z.boolean().optional(),
  obrigacoes: z
    .array(
      z.object({
        obrigacaoId: z.string(),
        tempoPrevistoOverride: z.number().int().min(0).optional().nullable(),
      }),
    )
    .optional(),
});

export const grupoSchema = z.object({
  nome: z.string().min(2, 'Nome do grupo e obrigatorio.'),
  ativo: z.boolean().optional(),
  // Aceita o formato novo (com tempo previsto por obrigacao) ou so a lista de ids (legado)
  obrigacoes: z
    .array(z.object({ obrigacaoId: z.string(), tempoPrevisto: z.number().int().min(0).default(0) }))
    .optional(),
  obrigacaoIds: z.array(z.string()).optional(),
});

export const feriadoSchema = z.object({
  dia: z.number().int().min(1).max(31),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(0).default(0), // 0 = recorrente (todo ano)
  nome: z.string().min(2, 'Descricao do feriado e obrigatoria.'),
  cidades: z.string().optional().nullable(),
});
