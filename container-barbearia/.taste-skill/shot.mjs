// measure section heights at 390 in headless chrome via CDP (one-off helper)
import { spawn } from 'node:child_process';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = process.cwd(), page = process.argv[2];
const srv = http.createServer((q, s) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } const ext = path.extname(f); s.writeHead(200, { 'content-type': { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream' }); s.end(d); }); }).listen(0, '127.0.0.1', async () => {
  const port = srv.address().port;
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const prof = path.join(root, '.taste-skill', 'chrome-medir');
  const ch = spawn(exe, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + prof, '--window-size=390,844', `http://127.0.0.1:${port}/${page}`], { stdio: ['ignore', 'ignore', 'pipe'] });
  let buf = ''; ch.stderr.on('data', async d => { buf += d; const m = buf.match(/ws:\/\/[^\s]+/); if (!m || ch._done) return; ch._done = 1;
    const list = await (await fetch(m[0].replace('ws://', 'http://').replace(/\/devtools\/browser\/.*/, '/json'))).json();
    const t = list.find(x => x.type === 'page'); const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const call = (method, params = {}) => new Promise(r => { const i = ++id; ws.addEventListener('message', e => { const j = JSON.parse(e.data); if (j.id === i) r(j.result); }); ws.send(JSON.stringify({ id: i, method, params })); });
    ws.onopen = async () => { await call('Emulation.setDeviceMetricsOverride', { width: +process.argv[3]||1440, height: +process.argv[4]||900, deviceScaleFactor: 1, mobile: (+process.argv[3]||1440) < 640 }); await call('Page.reload'); await new Promise(r => setTimeout(r, +(process.env.INICIO ?? 4000)));
      const y=+process.argv[5]||0; await call('Runtime.evaluate',{expression:'scrollTo(0,'+y+')'}); await new Promise(r=>setTimeout(r,(+process.env.ESPERA||3200))); const r = await call('Page.captureScreenshot',{format:'jpeg',quality:70}); fs.writeFileSync(process.argv[6],Buffer.from(r.data,'base64'));
       ws.close(); ch.kill(); srv.close(); process.exit(0); };
  });
});
