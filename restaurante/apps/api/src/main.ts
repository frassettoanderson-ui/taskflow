import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';
import { PASTA_DE_UPLOADS } from './modules/admin/upload.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });

  // Todas as rotas começam com /api
  app.setGlobalPrefix('api');

  // As fotos dos pratos, servidas direto do disco.
  // Ficam FORA do prefixo /api de propósito: são arquivos, não API.
  app.useStaticAssets(PASTA_DE_UPLOADS, {
    prefix: '/uploads/',
    // Imagem com nome sorteado nunca muda de conteúdo: pode ficar em cache.
    maxAge: '7d',
  });

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
