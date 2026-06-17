import { executarTodos } from '../modules/jobs/jobs.service.js';

let timer: NodeJS.Timeout | null = null;

// Scheduler simples baseado em setInterval (fallback sem BullMQ/Redis).
// Roda todos os jobs no boot (apos pequeno atraso) e a cada INTERVALO.
// Os jobs sao idempotentes, entao rodar de hora em hora e' seguro.
const INTERVALO_MS = 60 * 60 * 1000; // 1 hora

export function iniciarScheduler(): void {
  if (process.env.DISABLE_SCHEDULER === '1') {
    console.log('[GestorOA] Scheduler desabilitado (DISABLE_SCHEDULER=1)');
    return;
  }
  // primeira rodada apos 30s do boot (deixa a API subir antes)
  setTimeout(() => {
    executarTodos().catch((e) => console.error('[GestorOA] Erro no scheduler (boot):', e));
  }, 30_000);

  timer = setInterval(() => {
    executarTodos().catch((e) => console.error('[GestorOA] Erro no scheduler:', e));
  }, INTERVALO_MS);

  console.log(`[GestorOA] Scheduler iniciado (a cada ${INTERVALO_MS / 60000} min)`);
}

export function pararScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
