import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca uma rota como pública (não exige login).
 * Exemplo de uso na Etapa 1: a página do cardápio do cliente.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
