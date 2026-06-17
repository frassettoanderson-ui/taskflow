import { Router } from 'express';
import fs from 'node:fs';
import { prisma } from '../../prisma.js';
import { isInsideStorage } from '../../lib/storage.js';

// Rota PUBLICA de protocolo: /p/:token
// Registra data/hora/IP/user-agent de cada visualizacao e serve o documento.
const router = Router();

router.get('/:token', async (req, res) => {
  const protocolo = await prisma.protocolo.findUnique({
    where: { token: req.params.token },
    include: { documento: true, empresa: { select: { razaoSocial: true } } },
  });

  if (!protocolo) {
    return res.status(404).send(paginaErro('Link invalido ou expirado.'));
  }

  // registra a visualizacao
  await prisma.protocoloVisualizacao
    .create({
      data: {
        protocoloId: protocolo.id,
        ip: req.ip,
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 255),
      },
    })
    .catch(() => undefined);

  const doc = protocolo.documento;
  if (doc && isInsideStorage(doc.caminho) && fs.existsSync(doc.caminho)) {
    res.setHeader('Content-Disposition', `inline; filename="${doc.nomeArquivo}"`);
    if (doc.mimeType) res.setHeader('Content-Type', doc.mimeType);
    return res.sendFile(doc.caminho);
  }

  return res.send(
    paginaErro(
      `Documento de ${protocolo.empresa.razaoSocial} registrado, mas o arquivo nao esta disponivel.`,
    ),
  );
});

function paginaErro(msg: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>GestorOA</title>
  <style>body{font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#f1f5f4;color:#334155}
  .c{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08);max-width:420px;text-align:center}</style>
  </head><body><div class="c"><h2 style="color:#0f5c5e">GestorOA</h2><p>${msg}</p></div></body></html>`;
}

export default router;
