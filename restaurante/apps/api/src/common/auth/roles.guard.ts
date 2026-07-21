import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

/**
 * Confere o PAPEL do usuário (dono / gerente / operador).
 *
 * Roda depois do porteiro de login. Se a rota não pedir papel nenhum,
 * qualquer usuário logado passa.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const role: Role | undefined = request.auth?.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Seu perfil não tem permissão para esta ação.');
    }
    return true;
  }
}
