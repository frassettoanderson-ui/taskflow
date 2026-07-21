import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Conexão CRUA com o banco — sem nenhum filtro de tenant.
 *
 * ⚠️ Use isto SÓ em operações "de sistema", que por natureza acontecem antes
 * de sabermos quem é o tenant. Hoje é só o login (procurar o usuário pelo
 * e-mail) e o seed.
 *
 * Para qualquer coisa dentro de uma requisição já autenticada, use o
 * TenantPrismaService — ele injeta o tenantId sozinho e recusa consulta sem tenant.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
