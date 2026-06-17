import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import api from './routes.js';
import publicoProtocolo from './modules/protocolo/publico.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: env.appUrl,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api/v1', api);
  // Rota publica de protocolo (prova de entrega) - fora do /api
  app.use('/p', publicoProtocolo);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
