/* Controle remoto do Sorteio OX — servidor mínimo (sem dependências).
   Telão: POST /sync {since,state} a cada 1s -> recebe os comandos pendentes e informa o estado.
   Celular: POST /cmd?c=<comando>&k=<chave> e GET /state.
   Roda em 127.0.0.1:8410 atrás do nginx (/sorteio/api/). A chave fica em key.txt (não vai pro git). */
const http = require('http');
const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(__dirname, 'key.txt'), 'utf8').trim();
const CMDS = new Set(['play', 'next', 'mute', 'manual', 'fullscreen', 'home', 'reset']);
const STATUS = new Set(['idle', 'running', 'finished']);

const st = {
  seq: 0,
  cmds: [],            // {seq, cmd}, últimos 30
  state: { status: 'idle', muted: false, manual: false, title: '', eyebrow: '', winners: [] },
  lastSync: 0,
  lastCmd: {},         // anti duplo-toque por comando
};

const json = (res, o, c = 200) => {
  res.writeHead(c, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(o));
};
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

function readBody(req, max, cb) {
  let b = '';
  req.on('data', (d) => { b += d; if (b.length > max) req.destroy(); })
     .on('end', () => cb(b));
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (req.method === 'POST' && p === '/sync') {            // telão
    return readBody(req, 4000, (b) => {
      let d = {};
      try { d = JSON.parse(b); } catch (e) { /* ignora */ }
      st.lastSync = Date.now();
      const s = d.state || {};
      st.state = {
        status: STATUS.has(s.status) ? s.status : 'idle',
        muted: !!s.muted,
        manual: !!s.manual,
        title: str(s.title, 60),
        eyebrow: str(s.eyebrow, 40),
        winners: Array.isArray(s.winners) ? s.winners.slice(0, 40).map((w) => str(w, 60)) : [],
      };
      const since = Number.isInteger(d.since) ? d.since : null;
      json(res, { seq: st.seq, cmds: since === null ? [] : st.cmds.filter((c) => c.seq > since) });
    });
  }

  if (p === '/state') {                                    // celular
    return json(res, { ...st.state, telao: Date.now() - st.lastSync < 5000 });
  }

  if (req.method === 'POST' && p === '/cmd') {             // celular
    if (u.searchParams.get('k') !== KEY) return json(res, { error: 'chave invalida' }, 403);
    const c = u.searchParams.get('c');
    if (!CMDS.has(c)) return json(res, { error: 'comando invalido' }, 400);
    const now = Date.now();
    if (now - (st.lastCmd[c] || 0) < 800) return json(res, { ok: 0, motivo: 'aguarde' });
    st.lastCmd[c] = now;
    st.seq++;
    st.cmds.push({ seq: st.seq, cmd: c });
    if (st.cmds.length > 30) st.cmds.shift();
    return json(res, { ok: 1, seq: st.seq });
  }

  json(res, { error: 'nao encontrado' }, 404);
}).listen(8410, '127.0.0.1');
