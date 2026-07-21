import { Controller, Get, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Public } from '../../common/auth/public.decorator';

/**
 * "Está tudo de pé?" — usado por você para conferir que os 4 serviços subiram.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check() {
    const [db, cache] = await Promise.all([this.checkDb(), this.checkRedis()]);
    return {
      api: 'ok',
      db,
      cache,
      etapa: 0,
    };
  }

  private async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'falhou';
    }
  }

  private async checkRedis() {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'ok' : 'falhou';
    } catch {
      return 'falhou';
    }
  }
}
