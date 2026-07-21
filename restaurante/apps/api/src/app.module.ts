import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

import { CoreModule } from './core.module';
import { RedisModule } from './redis/redis.module';
import { AdaptersModule } from './adapters/adapters.module';

import { AuthModule } from './modules/auth/auth.module';
import { BrandModule } from './modules/brand/brand.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { OrderModule } from './modules/order/order.module';

import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { TOKEN_EXPIRES_IN } from './common/auth/auth.constants';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // O "crachá" (JWT) é global: middleware e serviço de login usam o mesmo.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: TOKEN_EXPIRES_IN },
      }),
    }),

    CoreModule,
    RedisModule,
    AdaptersModule,

    // Um módulo por área de negócio (vão crescer a cada etapa).
    AuthModule,
    BrandModule,
    CatalogModule,
    HealthModule,
    OrderModule,
  ],
  providers: [
    // Login exigido por padrão em TODAS as rotas.
    // Para abrir uma exceção, marque a rota com @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Depois do login, confere o papel quando a rota pedir @Roles(...).
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
