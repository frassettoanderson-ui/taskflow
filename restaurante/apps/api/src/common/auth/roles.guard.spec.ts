import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function fakeContext(auth: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    getHandler: () => null,
    getClass: () => null,
  } as any;
}

describe('RolesGuard', () => {
  function guardExigindo(roles: Role[] | undefined) {
    const reflector = { getAllAndOverride: () => roles } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('rota sem exigência de papel: qualquer logado passa', () => {
    expect(guardExigindo(undefined).canActivate(fakeContext({ role: Role.OPERATOR }))).toBe(true);
  });

  it('dono passa numa rota de dono', () => {
    expect(guardExigindo([Role.OWNER]).canActivate(fakeContext({ role: Role.OWNER }))).toBe(true);
  });

  it('operador é barrado numa rota de dono/gerente', () => {
    expect(() =>
      guardExigindo([Role.OWNER, Role.MANAGER]).canActivate(fakeContext({ role: Role.OPERATOR })),
    ).toThrow(ForbiddenException);
  });

  it('sem usuário nenhum, barra', () => {
    expect(() => guardExigindo([Role.OWNER]).canActivate(fakeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
