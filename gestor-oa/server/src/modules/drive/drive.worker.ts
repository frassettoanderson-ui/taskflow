import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { requestContext } from '../../context.js';
import { processarEntrada } from './drive.service.js';

// Polling: a cada intervalo, processa a pasta Entrada de cada escritorio conectado.
let rodando = false;

async function tick() {
  if (rodando) return; // evita sobreposicao
  rodando = true;
  try {
    const escritorios = await prisma.escritorio.findMany({ where: { deletedAt: null } });
    for (const esc of escritorios) {
      const cfg = (esc.config as Record<string, unknown>)?.drive as { refreshToken?: string } | undefined;
      if (!cfg?.refreshToken) continue;
      try {
        await requestContext.run({ escritorioId: esc.id }, () => processarEntrada(esc.id));
      } catch (e) {
        console.warn('[drive.worker] erro no escritorio', esc.id, (e as Error).message);
      }
    }
  } catch (e) {
    console.warn('[drive.worker] erro geral:', (e as Error).message);
  } finally {
    rodando = false;
  }
}

export function iniciarDriveWorker() {
  if (!env.drive.clientId) return; // sem credenciais, nao liga
  setInterval(tick, env.drive.pollMs);
  console.log(`[GestorOA] Drive worker ativo (poll ${Math.round(env.drive.pollMs / 1000)}s)`);
}
