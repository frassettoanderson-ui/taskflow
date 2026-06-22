#!/usr/bin/env node
/* ============================================================
 * Agente e-Continuo do GestorOA (instalador + agente, 1 .exe)
 * Pensado para usuarios leigos:
 *  - 1a execucao: janelas do Windows (sem terminal) pedem API key + setor,
 *    cria a pasta na Area de Trabalho, salva config, registra inicio automatico
 *    e ja sobe em SEGUNDO PLANO (oculto).
 *  - Toda inicializacao do Windows: sobe sozinho, oculto, vigiando a pasta.
 *  - Abrir o .exe de novo apenas garante que esta rodando e fecha.
 * ============================================================ */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const https = require('node:https');
const readline = require('node:readline');
const { execFileSync, spawn } = require('node:child_process');
const chokidar = require('chokidar');

const API_URL_PADRAO = 'http://89.117.79.163:8090';
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const CONFIG_PATH = path.join(APP_DIR, 'gestoroa-agente.config.json');
const LOCK_PATH = path.join(APP_DIR, 'gestoroa-agente.lock');
const BG = process.argv.includes('--bg');

function desktopDir() {
  const d = path.join(os.homedir(), 'Desktop');
  return fs.existsSync(d) ? d : os.homedir();
}

// ---------- Dialogos GUI do Windows (sempre em primeiro plano) ----------
// Janela TopMost com caixa de texto (substitui o InputBox do VB, que abria atras do terminal).
function inputBox(prompt, padrao) {
  const ps = [
    'Add-Type -AssemblyName System.Windows.Forms,System.Drawing;',
    '$f=New-Object System.Windows.Forms.Form;',
    "$f.Text='GestorOA e-Continuo';$f.TopMost=$true;$f.StartPosition='CenterScreen';$f.ClientSize=New-Object System.Drawing.Size(480,150);$f.FormBorderStyle='FixedDialog';$f.MaximizeBox=$false;$f.MinimizeBox=$false;",
    `$l=New-Object System.Windows.Forms.Label;$l.Text=${JSON.stringify(prompt)};$l.SetBounds(15,15,450,50);`,
    `$t=New-Object System.Windows.Forms.TextBox;$t.SetBounds(15,70,450,24);$t.Text=${JSON.stringify(padrao || '')};`,
    "$o=New-Object System.Windows.Forms.Button;$o.Text='OK';$o.SetBounds(300,105,80,28);$o.DialogResult=[System.Windows.Forms.DialogResult]::OK;",
    "$c=New-Object System.Windows.Forms.Button;$c.Text='Cancelar';$c.SetBounds(385,105,80,28);$c.DialogResult=[System.Windows.Forms.DialogResult]::Cancel;",
    '$f.Controls.AddRange(@($l,$t,$o,$c));$f.AcceptButton=$o;$f.CancelButton=$c;',
    '$f.Add_Shown({$f.Activate();$t.Focus()});',
    '$r=$f.ShowDialog();',
    "if($r -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Out.Write($t.Text)}",
  ].join('');
  try {
    return execFileSync('powershell', ['-NoProfile', '-STA', '-Command', ps], { encoding: 'utf8', windowsHide: true });
  } catch { return null; }
}
function msgBox(texto) {
  try {
    // 4096 = DefaultDesktopOnly: forca a janela a aparecer na frente de tudo. 64 = icone de informacao.
    execFileSync('powershell', ['-NoProfile', '-STA', '-Command', `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show(${JSON.stringify(texto)}, 'GestorOA e-Continuo', 0, 64, 0, 4096) | Out-Null`], { windowsHide: true });
  } catch { /* ignore */ }
}

// fallback p/ terminal quando GUI nao disponivel (dev)
function perguntaConsole(texto, padrao) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(padrao ? `${texto} [${padrao}]: ` : `${texto}: `, (r) => { rl.close(); resolve((r || padrao || '').trim()); });
  });
}

async function assistente() {
  let apiUrl = API_URL_PADRAO, apiKey = '', setor = 'Geral';
  const guiKey = inputBox('Cole a API key (Sistema > e-Continuo > Caixa do Robo > Integracao):', '');
  if (guiKey !== null) {
    apiKey = (guiKey || '').trim();
    if (apiKey) {
      const s = inputBox('Nome do setor/departamento (ex.: Fiscal):', 'Geral');
      setor = (s || 'Geral').trim() || 'Geral';
    }
  } else {
    // sem GUI -> terminal
    apiUrl = (await perguntaConsole('Endereco do sistema', API_URL_PADRAO)) || API_URL_PADRAO;
    while (!apiKey) apiKey = await perguntaConsole('Cole a API key');
    setor = (await perguntaConsole('Nome do setor/departamento', 'Geral')) || 'Geral';
  }
  if (!apiKey) { msgBox('API key nao informada. Abra o programa novamente para configurar.'); process.exit(1); }

  const pasta = path.join(desktopDir(), `GestorOA - ${setor}`);
  fs.mkdirSync(pasta, { recursive: true });
  const cfg = { apiUrl, apiKey, pasta, setor };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  registrarInicioAutomatico();
  msgBox(`Tudo pronto!\n\nFoi criada a pasta na Area de Trabalho:\n"${pasta}"\n\nArraste os documentos (PDF) para essa pasta - eles sobem sozinhos.\nO agente vai rodar em segundo plano e iniciar junto com o Windows.`);
  return cfg;
}

// Atalho .vbs na pasta Inicializar que roda o exe OCULTO (--bg) no logon.
function registrarInicioAutomatico() {
  if (!process.pkg) return;
  try {
    const startup = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    fs.mkdirSync(startup, { recursive: true });
    const vbs = `Set s = CreateObject("WScript.Shell")\r\ns.Run """${process.execPath}"" --bg", 0, False\r\n`;
    fs.writeFileSync(path.join(startup, 'GestorOA-eContinuo.vbs'), vbs);
  } catch (e) { /* sem autostart, segue */ }
}

// Sobe uma instancia OCULTA em segundo plano e encerra a atual (sem janela).
function subirEmSegundoPlano() {
  try {
    spawn(process.execPath, ['--bg'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch { /* ignore */ }
}

function lerConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; }
}

// Garante instancia unica em segundo plano.
function jaRodando() {
  try {
    const pid = Number(fs.readFileSync(LOCK_PATH, 'utf8'));
    if (pid && pid !== process.pid) { process.kill(pid, 0); return true; } // existe e vivo
  } catch { /* sem lock ou processo morto */ }
  return false;
}

// ---------- Upload multipart sem dependencias ----------
function enviarArquivo(cfg, arquivo) {
  return new Promise((resolve) => {
    let buf; try { buf = fs.readFileSync(arquivo); } catch (e) { return resolve({ ok: false, erro: e.message, rede: true }); }
    const nome = path.basename(arquivo);
    const boundary = '----goa' + Date.now() + Math.random().toString(16).slice(2);
    const pre = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="arquivos"; filename="${nome}"\r\nContent-Type: application/pdf\r\n\r\n`);
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([pre, buf, post]);
    let url; try { url = new URL('/api/v1/robo/ingest', cfg.apiUrl); } catch { return resolve({ ok: false, erro: 'apiUrl invalida' }); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: 'POST', hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname,
      headers: { 'x-api-key': cfg.apiKey, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    }, (res) => {
      let data = ''; res.on('data', (c) => (data += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(data); } catch {} resolve({ ok: res.statusCode >= 200 && res.statusCode < 300 && j && j.ok, status: res.statusCode, erro: j && j.error && j.error.message }); });
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
  const log = (...a) => { try { fs.appendFileSync(logFile, `[${new Date().toLocaleString('pt-BR')}] ${a.join(' ')}\n`); } catch {} };

  log(`e-Continuo iniciado (segundo plano). Setor: ${cfg.setor || '-'} | Pasta: ${PASTA}`);

  const fila = new Set();
  let processando = false;
  async function drenar() {
    if (processando) return; processando = true;
    for (const arq of [...fila]) {
      fila.delete(arq);
      if (!fs.existsSync(arq)) continue;
      const nome = path.basename(arq);
      const r = await enviarArquivo(cfg, arq);
      if (r.ok) { try { fs.renameSync(arq, destinoUnico(ENVIADOS, nome)); } catch {} log(`OK    ${nome}`); }
      else if (r.rede) { log(`FALHA ${nome} -> ${r.erro} (nova tentativa depois)`); }
      else { try { fs.renameSync(arq, destinoUnico(ERROS, nome)); } catch {} log(`ERRO  ${nome} -> ${r.erro || ('HTTP ' + r.status)}`); }
    }
    processando = false;
  }

  const watcher = chokidar.watch(PASTA, {
    ignored: [ENVIADOS, ERROS, logFile, /(^|[/\\])\../],
    ignoreInitial: false, awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 }, depth: 10,
  });
  watcher.on('add', (arq) => { if (path.extname(arq).toLowerCase() === '.pdf') { fila.add(arq); drenar(); } });

  setInterval(() => {
    const varrer = (dir) => {
      for (const nome of fs.readdirSync(dir)) {
        const arq = path.join(dir, nome);
        if (arq === ENVIADOS || arq === ERROS) continue;
        let st; try { st = fs.statSync(arq); } catch { continue; }
        if (st.isDirectory()) varrer(arq);
        else if (path.extname(nome).toLowerCase() === '.pdf') fila.add(arq);
      }
    };
    try { varrer(PASTA); drenar(); } catch {}
  }, 30000);
}

(async () => {
  let cfg = lerConfig();
  if (!cfg || !cfg.apiKey || !cfg.pasta) {
    cfg = await assistente();           // 1a vez: configura via janelas
    if (process.pkg) { subirEmSegundoPlano(); process.exit(0); } // sobe oculto e fecha
  }
  // Se foi aberto manualmente (sem --bg) e ja esta configurado: relanca oculto e fecha.
  if (process.pkg && !BG) {
    if (!jaRodando()) subirEmSegundoPlano();
    process.exit(0);
  }
  // Modo segundo plano: instancia unica + vigia
  if (jaRodando()) process.exit(0);
  try { fs.writeFileSync(LOCK_PATH, String(process.pid)); } catch {}
  const limpar = () => { try { fs.unlinkSync(LOCK_PATH); } catch {} };
  process.on('exit', limpar); process.on('SIGINT', () => { limpar(); process.exit(0); }); process.on('SIGTERM', () => { limpar(); process.exit(0); });
  await iniciar(cfg);
})();
