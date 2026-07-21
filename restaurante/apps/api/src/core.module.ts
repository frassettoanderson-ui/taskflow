import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { TenantContextService } from './common/tenant/tenant-context.service';
import { TenantPrismaService } from './common/tenant/tenant-prisma.service';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';
import { RealtimeService } from './common/realtime/realtime.service';

/**
 * Peças básicas que o projeto inteiro usa: banco, contexto de tenant e o
 * Prisma "com filtro". É @Global para nenhum módulo precisar importar de novo.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    TenantContextService,
    TenantPrismaService,
    TenantContextMiddleware,
    RealtimeService,
  ],
  exports: [
    PrismaService,
    TenantContextService,
    TenantPrismaService,
    TenantContextMiddleware,
    RealtimeService,
  ],
})
export class CoreModule {}
