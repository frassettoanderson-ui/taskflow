import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { LimitesService } from '../../modules/portal/limites.service';

/**
 * Rotas que continuam abertas mesmo com a conta bloqueada.
 *
 * É o detalhe que decide se o bloqueio cobra ou só irrita: sem estas exceções,
 * o restaurante devedor não conseguiria nem entrar para ver o boleto — e não
 * pagaria nunca.
 */
const SEMPRE_LIBERADO = [
  '/api/auth',
  '/api/health',
  // A tela da assinatura: é onde ele paga.
  '/api/portal-admin/assinatura',
  '/api/portal-admin/planos',
  // E o próprio aviso que EXPLICA o bloqueio. Sem esta linha, o restaurante
  // bloqueado via só telas quebradas, sem entender o motivo nem o caminho.
  '/api/portal-admin/consumo',
];

/**
 * O corte por falta de pagamento.
 *
 * Decisão do fundador: bloqueio total a partir de **15 dias** de atraso.
 * Antes disso o sistema só avisa — quem avisa é a tela, não este porteiro.
 */
@Injectable()
export class AssinaturaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limites: LimitesService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    // Rota pública tem tratamento próprio (o cardápio mostra recado, não erro).
    if (publico) return true;

    const req = contexto.switchToHttp().getRequest();
    const caminho: string = req.originalUrl ?? req.url ?? '';
    if (SEMPRE_LIBERADO.some((c) => caminho.startsWith(c))) return true;

    // O JwtAuthGuard, que roda antes, deixa o usuário em `req.auth`.
    const tenantId = req.auth?.tenantId;
    if (!tenantId) return true; // sem login o guard de autenticação já barrou

    await this.limites.exigirEmDia(tenantId);
    return true;
  }
}
