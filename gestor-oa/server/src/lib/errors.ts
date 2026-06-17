// Erro de aplicacao com codigo e status HTTP, mensagem em PT-BR.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  naoAutenticado: () =>
    new AppError(401, 'NAO_AUTENTICADO', 'Sessao invalida ou expirada.'),
  semPermissao: (flag?: string) =>
    new AppError(
      403,
      'SEM_PERMISSAO',
      'Voce nao tem permissao para esta acao.',
      flag ? { flag } : undefined,
    ),
  naoEncontrado: (oque = 'Registro') =>
    new AppError(404, 'NAO_ENCONTRADO', `${oque} nao encontrado.`),
  credenciaisInvalidas: () =>
    new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.'),
  foraDoHorario: () =>
    new AppError(
      403,
      'FORA_DO_HORARIO',
      'Acesso nao permitido neste horario.',
    ),
  conflito: (message: string) => new AppError(409, 'CONFLITO', message),
  validacao: (message: string, details?: unknown) =>
    new AppError(422, 'VALIDACAO', message, details),
};
