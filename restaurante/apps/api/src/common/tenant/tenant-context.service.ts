import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Role } from '@prisma/client';

/** O que sabemos sobre "quem está falando" durante uma requisição. */
export interface RequestContext {
  tenantId: string;
  userId: string;
  role: Role;
}

/**
 * Guarda o contexto da requisição atual (quem é o usuário e de qual tenant).
 *
 * Pense nisto como uma "etiqueta" colada na requisição: qualquer código que
 * rodar por causa dela consegue ler a etiqueta, sem ninguém precisar ficar
 * passando o tenantId de função em função (que é onde se esquece e vaza dado).
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext | null>();

  /** Roda `fn` com este contexto colado. */
  run<T>(ctx: RequestContext | null, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }

  /** Lê o contexto atual (ou null se a requisição não está autenticada). */
  get(): RequestContext | null {
    return this.storage.getStore() ?? null;
  }

  /** Lê o tenantId atual (ou null). */
  getTenantId(): string | null {
    return this.get()?.tenantId ?? null;
  }
}
