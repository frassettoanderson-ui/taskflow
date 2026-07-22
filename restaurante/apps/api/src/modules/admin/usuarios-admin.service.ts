import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';

export const NOME_DO_PAPEL: Record<Role, string> = {
  OWNER: 'Dono',
  MANAGER: 'Gerente',
  CASHIER: 'Caixa',
  WAITER: 'Garçom',
  OPERATOR: 'Cozinha',
};

/** O que cada papel enxerga — mostrado na tela para não ficar adivinhação. */
export const O_QUE_O_PAPEL_FAZ: Record<Role, string> = {
  OWNER: 'Tudo, inclusive financeiro, marketing e assinatura.',
  MANAGER: 'Tudo do dia a dia: pedidos, salão, estoque, relatórios e marketing.',
  CASHIER: 'Salão, fechar conta e receber, cozinha e entregas.',
  WAITER: 'Salão e lançar pedido. Não mexe em dinheiro.',
  OPERATOR: 'Só a tela da cozinha.',
};

@Injectable()
export class UsuariosAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async listar() {
    const usuarios = await this.tenantPrisma.db.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { pedidosLancados: true } },
      },
    });

    return usuarios.map((u) => ({
      id: u.id,
      nome: u.name,
      email: u.email,
      papel: u.role,
      papelLabel: NOME_DO_PAPEL[u.role],
      oQueFaz: O_QUE_O_PAPEL_FAZ[u.role],
      pedidosLancados: u._count.pedidosLancados,
      desde: u.createdAt,
    }));
  }

  /** Os papéis disponíveis, para o formulário. */
  papeis() {
    return Object.values(Role).map((r) => ({
      valor: r,
      label: NOME_DO_PAPEL[r],
      oQueFaz: O_QUE_O_PAPEL_FAZ[r],
    }));
  }

  async criar(dados: { name: string; email: string; password: string; role: Role }) {
    const email = dados.email.trim().toLowerCase();

    if (!email.includes('@')) throw new BadRequestException('Informe um e-mail válido.');
    if (dados.password.length < 6) {
      throw new BadRequestException('A senha precisa ter pelo menos 6 caracteres.');
    }

    // ⚠️ O e-mail é único no sistema INTEIRO (ponta solta desde a Etapa 0).
    // Por isso a checagem usa o prisma cru: precisamos saber se existe em
    // qualquer empresa, não só na nossa.
    const existe = await this.prisma.user.findUnique({ where: { email } });
    if (existe) {
      throw new BadRequestException('Já existe um usuário com este e-mail.');
    }

    const usuario = await this.tenantPrisma.db.user.create({
      data: {
        name: dados.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dados.password, 10),
        role: dados.role,
      } as any,
      select: { id: true, name: true, email: true, role: true },
    });

    return { ...usuario, papelLabel: NOME_DO_PAPEL[usuario.role] };
  }

  async atualizar(id: string, dados: Partial<{ name: string; role: Role }>) {
    await this.exigirMeu(id);
    return this.tenantPrisma.db.user.update({
      where: { id },
      data: dados,
      select: { id: true, name: true, email: true, role: true },
    });
  }

  /** Troca a senha de alguém (o dono resetando a de um funcionário). */
  async trocarSenha(id: string, novaSenha: string) {
    await this.exigirMeu(id);
    if (novaSenha.length < 6) {
      throw new BadRequestException('A senha precisa ter pelo menos 6 caracteres.');
    }

    await this.tenantPrisma.db.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(novaSenha, 10) },
    });

    return { ok: true };
  }

  /**
   * Apagar usuário.
   *
   * Duas travas: não dá para apagar a si mesmo, nem para deixar a empresa sem
   * nenhum dono — seria o jeito mais fácil de perder o acesso para sempre.
   */
  async apagar(id: string, quemPediu: string) {
    if (id === quemPediu) throw new BadRequestException('Você não pode apagar a si mesmo.');

    const alvo = await this.tenantPrisma.db.user.findUnique({ where: { id } });
    if (!alvo) throw new NotFoundException('Usuário não encontrado.');

    if (alvo.role === Role.OWNER) {
      const donos = await this.tenantPrisma.db.user.count({ where: { role: Role.OWNER } });
      if (donos <= 1) {
        throw new BadRequestException('Esta é a única conta de dono. Crie outra antes de apagar.');
      }
    }

    await this.tenantPrisma.db.user.delete({ where: { id } });
    return { apagado: true };
  }

  private async exigirMeu(id: string) {
    const u = await this.tenantPrisma.db.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
  }
}
