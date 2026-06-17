#!/usr/bin/env node
// ============================================================
// Agente e-Continuo do GestorOA
// Vigia uma pasta local e envia automaticamente os PDFs novos
// para a rota de ingestao do sistema (POST /api/v1/robo/ingest).
// Requer Node 18+ (usa fetch/FormData/Blob nativos).
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

function carregarConfig() {
  // procura agent.config.json ao lado do executavel/script
  const candidatos = [
    path.join(process.cwd(), 'agent.config.json'),
    path.join(AQUI, 'agent.config.json'),
  ];
  const arquivo = candidatos.find((p) => fs.existsSync(p));
  if (!arquivo) {
    console.error('[e-Continuo] agent.config.json nao encontrado. Copie o agent.config.example.json e preencha.');
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  if (!cfg.apiUrl || !cfg.apiKey || !cfg.pasta) {
    console.error('[e-Continuo] Config invalida: preencha apiUrl, apiKey e pasta.');
    process.exit(1);
  }
  cfg.intervaloSegundos = cfg.intervaloSegundos ?? 5;
  return cfg;
}

const cfg = carregarConfig();
const PASTA = path.resolve(cfg.pasta);
const ENVIADOS = path.join(PASTA, 'enviados');
const ERROS = path.join(PASTA, 'erros');
const INGEST = cfg.apiUrl.replace(/\/$/, '') + '/api/v1/robo/ingest';

for (const dir of [PASTA, ENVIADOS, ERROS]) fs.mkdirSync(dir, { recursive: true });

function log(...a) {
  const linha = `[${new Date().toLocaleString('pt-BR')}] ${a.join(' ')}`;
  console.log(linha);
  try { fs.appendFileSync(path.join(PASTA, 'agente.log'), linha + '\n'); } catch { /* ignore */ }
}

function destinoUnico(dir, nome) {
  let alvo = path.join(dir, nome);
  if (!fs.existsSync(alvo)) return alvo;
  const ext = path.extname(nome);
  const base = path.basename(nome, ext);
  return path.join(dir, `${base}_${Date.now()}${ext}`);
}

async function enviar(arquivo) {
  const nome = path.basename(arquivo);
  try {
    const buf = fs.readFileSync(arquivo);
    const form = new FormData();
    form.append('arquivos', new Blob([buf], { type: 'application/pdf' }), nome);

    const resp = await fetch(INGEST, {
      method: 'POST',
      headers: { 'x-api-key': cfg.apiKey },
      body: form,
    });
    const json = await resp.json().catch(() => null);

    if (resp.ok && json?.ok) {
      fs.renameSync(arquivo, destinoUnico(ENVIADOS, nome));
      log(`OK    ${nome} -> enviado`);
    } else {
      const msg = json?.error?.message || `HTTP ${resp.status}`;
      fs.renameSync(arquivo, destinoUnico(ERROS, nome));
      log(`ERRO  ${nome} -> ${msg} (movido p/ erros)`);
    }
  } catch (e) {
    // erro de rede: NAO move (tenta de novo na proxima vez que o watcher reescanear)
    log(`FALHA ${nome} -> ${e?.message || e} (mantido p/ nova tentativa)`);
  }
}

log(`e-Continuo iniciado. Vigiando: ${PASTA}`);
log(`Destino: ${INGEST}`);

const watcher = chokidar.watch(PASTA, {
  ignored: [ENVIADOS, ERROS, path.join(PASTA, 'agente.log'), /(^|[/\\])\../],
  depth: 0,
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
});

const fila = new Set();
let processando = false;

async function drenar() {
  if (processando) return;
  processando = true;
  for (const arq of [...fila]) {
    fila.delete(arq);
    if (fs.existsSync(arq)) await enviar(arq);
  }
  processando = false;
}

watcher.on('add', (arq) => {
  if (path.extname(arq).toLowerCase() !== '.pdf') return;
  fila.add(arq);
  drenar();
});

// reescaneia periodicamente (retry de falhas de rede)
setInterval(() => {
  for (const nome of fs.readdirSync(PASTA)) {
    const arq = path.join(PASTA, nome);
    if (fs.statSync(arq).isFile() && path.extname(nome).toLowerCase() === '.pdf') fila.add(arq);
  }
  drenar();
}, Math.max(5, cfg.intervaloSegundos) * 1000);

process.on('SIGINT', () => { log('Encerrando e-Continuo.'); watcher.close(); process.exit(0); });
