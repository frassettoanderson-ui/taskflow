import { z } from 'zod';

const senha = z
  .string({ required_error: 'Senha e obrigatoria.' })
  .min(8, 'A senha deve ter ao menos 8 caracteres.');

export const registrarEscritorioSchema = z.object({
  escritorio: z.object({
    nome: z.string({ required_error: 'Nome do escritorio e obrigatorio.' }).min(2, 'Nome muito curto.'),
    cnpj: z.string().optional(),
  }),
  admin: z.object({
    nome: z.string({ required_error: 'Nome e obrigatorio.' }).min(2, 'Nome muito curto.'),
    email: z.string({ required_error: 'E-mail e obrigatorio.' }).email('E-mail invalido.'),
    senha,
  }),
});

export const loginSchema = z.object({
  email: z.string({ required_error: 'E-mail e obrigatorio.' }).email('E-mail invalido.'),
  senha: z.string({ required_error: 'Senha e obrigatoria.' }).min(1, 'Informe a senha.'),
});

export const solicitarResetSchema = z.object({
  email: z.string({ required_error: 'E-mail e obrigatorio.' }).email('E-mail invalido.'),
});

export const redefinirSenhaSchema = z.object({
  token: z.string({ required_error: 'Token e obrigatorio.' }).min(10, 'Token invalido.'),
  novaSenha: senha,
});

export type RegistrarEscritorioInput = z.infer<typeof registrarEscritorioSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
