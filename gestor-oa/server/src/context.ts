import { AsyncLocalStorage } from 'node:async_hooks';

// Contexto por requisicao, usado pelo middleware de auditoria do Prisma
// para saber QUEM fez a acao e em qual tenant, sem precisar passar o
// usuario explicitamente em toda chamada.
export interface RequestContext {
  escritorioId: string;
  usuarioId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContext.run(ctx, fn);
}
