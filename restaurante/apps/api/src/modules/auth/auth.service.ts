import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { JwtPayload, TOKEN_EXPIRES_IN } from '../../common/auth/auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService, // conexão crua: só para o login
    private readonly tenantPrisma: TenantPrismaService, // conexão com filtro de tenant
    private readonly jwt: JwtService,
  ) {}

  /**
   * Confere e-mail e senha e devolve o "crachá" (token).
   *
   * Usa a conexão CRUA de propósito: neste momento ainda não sabemos de qual
   * tenant o usuário é — é justamente isso que estamos descobrindo.
   */
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { tenant: true },
    });

    // Mensagem genérica de propósito: não entregamos se o e-mail existe ou não.
    const erro = new UnauthorizedException('E-mail ou senha inválidos.');
    if (!user) throw erro;

    const senhaConfere = await bcrypt.compare(password, user.passwordHash);
    if (!senhaConfere) throw erro;

    const payload: JwtPayload = {
      sub: user.id,
      tid: user.tenantId,
      role: user.role,
    };

    const token = await this.jwt.signAsync(payload, { expiresIn: TOKEN_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
      },
    };
  }

  /**
   * Dados de quem está logado agora.
   *
   * Aqui usamos a conexão COM filtro de tenant: as marcas que voltam são,
   * garantidamente, só as do tenant do usuário.
   */
  async me(userId: string, tenantId: string) {
    const user = await this.tenantPrisma.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, tenantId: true },
    });

    if (!user) throw new UnauthorizedException('Usuário não encontrado.');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });

    const brands = await this.tenantPrisma.db.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, primaryColor: true, logoUrl: true },
    });

    return { user, tenant, brands };
  }
}
