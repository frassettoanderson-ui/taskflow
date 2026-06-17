import { z } from 'zod';

export const regraPrazoSchema = z.object({
  tipoDia: z.enum(['DIA_FIXO', 'DIA_UTIL']),
  dia: z.number().int().min(1).max(31),
  regraNaoUtil: z.enum(['ANTECIPA', 'POSTERGA', 'MANTEM']).default('ANTECIPA'),
  sabadoEhUtil: z.boolean().optional(),
  diasAntesTecnico: z.number().int().min(0).default(0),
  tipoDiasAntes: z.enum(['CORRIDOS', 'UTEIS']).default('CORRIDOS'),
});

export const obrigacaoSchema = z.object({
  nome: z.string().min(2, 'Nome da obrigacao e obrigatorio.'),
  departamentoId: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  periodicidade: z.enum(['MENSAL', 'TRIMESTRAL', 'ANUAL', 'EVENTUAL']).default('MENSAL'),
  regraPrazo: regraPrazoSchema,
  tempoPrevistoMin: z.number().int().min(0).default(0),
  exigeAnexoNaBaixa: z.boolean().default(false),
  exigeBaixaPeloRobo: z.boolean().default(false),
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
  obrigacaoIds: z.array(z.string()).optional(),
});

export const feriadoSchema = z.object({
  data: z.string(), // yyyy-MM-dd
  nome: z.string().min(2, 'Nome do feriado e obrigatorio.'),
  abrangencia: z.enum(['NACIONAL', 'ESTADUAL', 'MUNICIPAL']).default('NACIONAL'),
  uf: z.string().optional().nullable(),
  municipio: z.string().optional().nullable(),
});
