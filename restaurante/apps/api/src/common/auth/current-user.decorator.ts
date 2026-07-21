import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestContext } from '../tenant/tenant-context.service';

/**
 * Atalho para pegar o usuário logado dentro de um controller.
 * Ex.: `metodo(@CurrentUser() user: RequestContext) { ... }`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    return ctx.switchToHttp().getRequest().auth;
  },
);
