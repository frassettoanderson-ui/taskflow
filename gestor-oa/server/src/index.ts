import { createApp } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';
import { iniciarWatcher } from './modules/robo/watcher.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[GestorOA] API rodando em ${env.apiUrl} (porta ${env.port})`);
  console.log(`[GestorOA] Ambiente: ${env.nodeEnv} | TZ: ${env.tz}`);
  try {
    iniciarWatcher();
  } catch (e) {
    console.error('[GestorOA] Falha ao iniciar watcher do robo:', e);
  }
});

async function shutdown(signal: string) {
  console.log(`\n[GestorOA] Recebido ${signal}, encerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
