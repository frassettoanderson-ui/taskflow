#!/usr/bin/env node
/* ============================================================
 * Agente e-Continuo do GestorOA (instalador + agente em um so .exe)
 * - 1a execucao: assistente pede API key + nome do setor, cria a pasta
 *   na Area de Trabalho, salva config e registra para iniciar no logon.
 * - Execucoes seguintes: vigia a pasta (e subpastas) e envia os PDFs.
 * Sem dependencia de Node instalado quando empacotado com pkg.
 * ============================================================ */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const https = require('node:https');
const readline = require('node:readline');
const { execFileSync } = require('node:child_process');
const chokidar = require('chokidar');

const API_URL_PADRAO = 'http://89.117.79.163:8090';
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const CONFIG_PATH = path.join(APP_DIR, 'gestoroa-agente.config.json');

function desktopDir() {
  // tenta Desktop; se OneDrive estiver no caminho, ainda funciona via homedir
  const d = path.join(os.homedir(), 'Desktop');
  return fs.existsSync(d) ? d : os.homedir();
}

function pergunta(rl, texto, padrao) {
  return new Promise((resolve) => {
    rl.question(padrao ? `${texto} [${padrao}]: ` : `${texto}: `, (resp) => resolve((resp || padrao || '').trim()));
  });
}

async function assistente() {
  console.log('\n=== GestorOA · e-Continuo — Instalacao ===\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const apiUrl = (await pergunta(rl, 'Endereco do sistema', API_URL_PADRAO)) || API_URL_PADRAO;
  let apiKey = '';
  while (!apiKey) apiKey = await pergunta(rl, 'Cole a API key (Sistema > e-Continuo > Caixa do Robo > Integracao)');
  const setor = await pergunta(rl, 'Nome do setor/departamento (ex.: Fiscal)', 'Geral');
  rl.close();

  const pasta = path.join(desktopDir(), `GestorOA - ${setor}`);
  fs.mkdirSync(pasta, { recursive: true });

  const cfg = { apiUrl, apiKey, pasta, setor };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  registrarInicioAutomatico();

  console.log(`\nPronto! Pasta criada na Area de Trabalho: "${pasta}"`);
  console.log('Arraste os documentos (PDF) para essa pasta que eles sobem sozinhos.');
  console.log('O agente vai iniciar junto com o Windows. Iniciando agora...\n');
  return cfg;
}

// Cria um atalho .vbs na pasta Inicializar do Windows que roda o exe escondido.
function registrarInicioAutomatico() {
  if (!process.pkg) return; // so faz sentido no .exe
  try {
    const startup = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    fs.mkdirSync(startup, { recursive: true });
    const vbs = `Set s = CreateObject("WScript.Shell")\r\ns.Run """${process.execPath}""", 0, False\r\n`;
    fs.writeFileSync(path.join(startup, 'GestorOA-eContinuo.vbs'), vbs);
  } catch (e) {
    console.error('Aviso: nao foi possivel registrar inicio automatico:', e.message);
  }
}

function lerConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; }
}

// Upload multipart (sem dependencias) para POST {apiUrl}/api/v1/robo/ingest
function enviarArquivo(cfg, arquivo) {
  return new Promise((resolve) => {
    let buf;
    try { buf = fs.readFileSync(arquivo); } catch (e) { return resolve({ ok: false, erro: e.message, rede: true }); }
    const nome = path.basename(arquivo);
    const boundary = '----goa' + Date.now() + Math.random().toString(16).slice(2);
    const pre = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="arquivos"; filename="${nome}"\r\nContent-Type: application/pdf\r\n\r\n`);
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([pre, buf, post]);
    let url;
    try { url = new URL('/api/v1/robo/ingest', cfg.apiUrl); } catch (e) { return resolve({ ok: false, erro: 'apiUrl invalida' }); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: 'POST', hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname,
      headers: { 'x-api-key': cfg.apiKey, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null; try { json = JSON.parse(data); } catch { /* ignore */ }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300 && json && json.ok, status: res.statusCode, erro: json && json.error && json.error.message });
      });
    });
    req.on('error', (e) => resolve({ ok: false, erro: e.message, rede: true }));
    req.write(body); req.end();
  });
}

function destinoUnico(dir, nome) {
  let alvo = path.join(dir, nome);
  if (!fs.existsSync(alvo)) return alvo;
  const ext = path.extname(nome), base = path.basename(nome, ext);
  return path.join(dir, `${base}_${Date.now()}${ext}`);
}

async function iniciar(cfg) {
  const PASTA = path.resolve(cfg.pasta);
  const ENVIADOS = path.join(PASTA, '_enviados');
  const ERROS = path.join(PASTA, '_erros');
  for (const d of [PASTA, ENVIADOS, ERROS]) fs.mkdirSync(d, { recursive: true });

  const logFile = path.join(PASTA, 'agente.log');
  const log = (...a) => {
    const linha = `[${new Date().toLocaleString('pt-BR')}] ${a.join(' ')}`;
    console.log(linha);
    try { fs.appendFileSync(logFile, linha + '\n'); } catch { /* ignore */ }
  };

  log(`e-Continuo iniciado. Setor: ${cfg.setor || '-'}`);
  log(`Vigiando: ${PASTA}`);

  const fila = new Set();
  let processando = false;
  async function drenar() {
    if (processando) return; processando = true;
    for (const arq of [...fila]) {
      fila.delete(arq);
      if (!fs.existsSync(arq)) continue;
      const nome = path.basename(arq);
      const r = await enviarArquivo(cfg, arq);
      if (r.ok) { try { fs.renameSync(arq, destinoUnico(ENVIADOS, nome)); } catch {} log(`OK    ${nome} -> enviado`); }
      else if (r.rede) { log(`FALHA ${nome} -> ${r.erro} (mantido p/ nova tentativa)`); }
      else { try { fs.renameSync(arq, destinoUnico(ERROS, nome)); } catch {} log(`ERRO  ${nome} -> ${r.erro || ('HTTP ' + r.status)} (movido p/ _erros)`); }
    }
    processando = false;
  }

  const watcher = chokidar.watch(PASTA, {
    ignored: [ENVIADOS, ERROS, logFile, /(^|[/\\])\../],
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
    depth: 10,
  });
  watcher.on('add', (arq) => { if (path.extname(arq).toLowerCase() === '.pdf') { fila.add(arq); drenar(); } });

  setInterval(() => {
    const varrer = (dir) => {
      for (const nome of fs.readdirSync(dir)) {
        const arq = path.join(dir, nome);
        if (arq === ENVIADOS || arq === ERROS) continue;
        const st = fs.statSync(arq);
        if (st.isDirectory()) varrer(arq);
        else if (path.extname(nome).toLowerCase() === '.pdf') fila.add(arq);
      }
    };
    try { varrer(PASTA); drenar(); } catch { /* ignore */ }
  }, 30000);
}

(async () => {
  let cfg = lerConfig();
  if (!cfg || !cfg.apiKey || !cfg.pasta) {
    if (!process.stdin.isTTY && process.pkg) {
      console.error('Configuracao ausente. Abra o programa manualmente para configurar.');
      process.exit(1);
    }
    cfg = await assistente();
  }
  await iniciar(cfg);
})();
