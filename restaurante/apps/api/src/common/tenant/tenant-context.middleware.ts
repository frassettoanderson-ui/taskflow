import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AUTH_COOKIE, JwtPayload } from '../auth/auth.constants';
import { RequestContext, TenantContextService } from './tenant-context.service';

/**
 * Roda ANTES de tudo, em toda requisição.
 *
 * Lê o crachá (cookie), descobre quem é o usuário e de qual tenant, e "cola"
 * essa informação na requisição. A partir daí, todo o resto do código —
 * inclusive as consultas ao banco — já sabe de qual restaurante estamos falando.
 *
 * Se não houver crachá, o contexto fica vazio: a requisição segue (pode ser uma
 * rota pública, como o cardápio na Etapa 1), mas qualquer consulta a tabela de
 * tenant vai ser bloqueada.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly context: TenantContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.[AUTH_COOKIE];
    let ctx: RequestContext | null = null;

    if (token) {
      try {
        const payload = this.jwt.verify<JwtPayload>(token);
        ctx = {
          userId: payload.sub,
          tenantId: payload.tid,
          role: payload.role as Role,
        };
      } catch {
        // Crachá inválido ou vencido: tratamos como "não logado".
        ctx = null;
      }
    }

    (req as any).auth = ctx;

    // Tudo que rodar daqui pra frente enxerga este contexto.
    this.context.run(ctx, () => next());
  }
}
