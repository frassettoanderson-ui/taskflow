import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });

  // Todas as rotas começam com /api
  app.setGlobalPrefix('api');

  // Ler cookies (é onde fica o crachá de login)
  app.use(cookieParser());

  // Cola o "quem é você / de qual tenant" em toda requisição.
  // Registrado aqui, e não pelo módulo, para rodar antes de qualquer rota.
  const tenantContext = app.get(TenantContextMiddleware);
  app.use(tenantContext.use.bind(tenantContext));

  // Valida automaticamente o que chega do frontend.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos que não pedimos
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // O frontend fala com a API pelo próprio endereço dele (localhost:3010),
  // então o CORS aqui é só uma rede de segurança para testes diretos.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3010',
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3011);
  await app.listen(port, '0.0.0.0');

  Logger.log(`🚀 API no ar em http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
