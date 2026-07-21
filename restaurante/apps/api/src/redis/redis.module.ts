import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Conexão com o Redis.
 *
 * Nesta Etapa 0 ele só fica de pé (e aparece no /api/health). A partir da
 * Etapa 1 ele passa a carregar o tempo real do KDS e as filas de tarefas.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor() {}
  async onApplicationShutdown() {
    // o ioredis fecha sozinho ao encerrar o processo
  }
}
