import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * "Porteiro" do sistema: barra quem não está logado.
 *
 * Ele não faz o trabalho de ler o crachá (isso já aconteceu no
 * TenantContextMiddleware) — só confere se existe um crachá válido.
 *
 * Rotas marcadas com @Public() passam sem crachá.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.auth) {
      throw new UnauthorizedException('Você precisa entrar para acessar isto.');
    }
    return true;
  }
}
