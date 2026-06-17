import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { prisma } from '../../prisma.js';
import { ensureDir, STORAGE_ROOT } from '../../lib/storage.js';
import { requestContext } from '../../context.js';
import { processarArquivo } from './robo.service.js';

// Monitora /storage/robo/inbox/{escritorioId}/ e processa PDFs novos.
// Para evitar dependencia de escritorioId no nome, usamos subpastas por tenant.
export function iniciarWatcher() {
  const inbox = ensureDir(path.join(STORAGE_ROOT, 'robo', 'inbox'));
  const watcher = chokidar.watch(inbox, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 300 },
    depth: 2,
  });

  watcher.on('add', async (caminho) => {
    if (!caminho.toLowerCase().endsWith('.pdf')) return;
    // estrutura esperada: inbox/{escritorioId}/arquivo.pdf
    const rel = path.relative(inbox, caminho);
    const partes = rel.split(path.sep);
    const escritorioId = partes.length >= 2 ? partes[0] : null;
    if (!escritorioId) return;
    const existe = await prisma.escritorio.findUnique({ where: { id: escritorioId } }).catch(() => null);
    if (!existe) return;
    try {
      await requestContext.run({ escritorioId }, () =>
        processarArquivo(escritorioId, caminho, path.basename(caminho), 'WATCHER'),
      );
      // move para processados
      const dest = ensureDir(path.join(STORAGE_ROOT, 'robo', 'processados', escritorioId));
      fs.rename(caminho, path.join(dest, path.basename(caminho)), () => undefined);
    } catch (e) {
      console.error('[robo watcher] erro ao processar', caminho, e);
    }
  });

  console.log(`[GestorOA] Watcher do robo monitorando ${inbox}`);
}
