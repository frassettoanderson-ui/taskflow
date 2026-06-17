import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 4002),
  appUrl: process.env.APP_URL ?? 'http://localhost:5174',
  apiUrl: process.env.API_URL ?? 'http://localhost:4002',

  databaseUrl: required('DATABASE_URL', 'postgresql://gestoroa:gestoroa@localhost:5432/gestoroa?schema=public'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
    refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'goa_refresh',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },

  tz: process.env.TZ ?? 'America/Sao_Paulo',
  storageRoot: process.env.STORAGE_ROOT ?? './storage',

  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    fromName: process.env.MAIL_FROM_NAME ?? 'GestorOA',
    fromEmail: process.env.MAIL_FROM_EMAIL ?? 'nao-responder@exemplo.com.br',
  },

  queue: {
    driver: (process.env.QUEUE_DRIVER ?? 'postgres') as 'postgres' | 'bullmq',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  ocrLang: process.env.OCR_LANG ?? 'por',
};
