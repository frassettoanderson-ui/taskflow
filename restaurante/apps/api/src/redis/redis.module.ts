import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

function criar(config: ConfigService) {
  return new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
}

/**
 * Conexões com o Redis.
 *
 * São DUAS de propósito: no Redis, uma conexão que está "ouvindo" avisos
 * (subscriber) não pode fazer mais nada. Então uma escuta e a outra trabalha.
 *
 * É isto que sustenta o tempo real: quando um pedido muda de situação, a API
 * grita no Redis e todas as telas abertas ouvem — inclusive se amanhã houver
 * vários servidores rodando ao mesmo tempo.
 */
@Global()
@Module({
  providers: [
    { provide: REDIS_CLIENT, inject: [ConfigService], useFactory: criar },
    { provide: REDIS_SUBSCRIBER, inject: [ConfigService], useFactory: criar },
  ],
  exports: [REDIS_CLIENT, REDIS_SUBSCRIBER],
})
export class RedisModule {}
