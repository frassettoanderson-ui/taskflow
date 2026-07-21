import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequestContext } from '../../common/tenant/tenant-context.service';
import { AUTH_COOKIE, COOKIE_MAX_AGE_MS } from '../../common/auth/auth.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Entrar no sistema. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);

    // O crachá vai num cookie "httpOnly": o JavaScript da página NÃO consegue
    // lê-lo, o que protege contra roubo de sessão.
    res.cookie(AUTH_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // em desenvolvimento é http; em produção vira true
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });

    return { user: result.user, tenant: result.tenant };
  }

  /** Sair do sistema (apaga o cookie). */
  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }

  /** Quem sou eu? (usado pelo Painel) */
  @Get('me')
  me(@CurrentUser() user: RequestContext) {
    return this.auth.me(user.userId, user.tenantId);
  }
}
