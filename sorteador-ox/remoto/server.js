/* Controle remoto do Sorteio OX — servidor mínimo (sem dependências).
   Telão: POST /sync {since,state} a cada 1s -> recebe os comandos pendentes e informa o estado.
   Celular: POST /cmd?c=<comando>&k=<chave> e GET /state.
   Roda em 127.0.0.1:8410 atrás do nginx (/sorteio/api/). A chave fica em key.txt (não vai pro git). */
const http = require('http');
const fs = require('fs');
const path = require('path');

const KEY = fs.readFileSync(path.join(__dirname, 'key.txt'), 'utf8').trim();
const CMDS = new Set(['play', 'next', 'mute', 'fullscreen', 'home', 'reset', 'aovivo']);

/* Sorteio AO VIVO: só quem está treinando agora (catraca da EVO, via API do OX Cloud no próprio
   servidor). Ganhadores ao vivo ficam em aovivo.json, SEPARADOS do grande sorteio; quem já ganhou
   hoje não entra de novo (no dia seguinte participa). */
const OX_TREINANDO = 'http://127.0.0.1:8401/api/evo/treinando-agora';
const AOVIVO_FILE = path.join(__dirname, 'aovivo.json');
const hojeBr = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
function lerAoVivo() {
  let d = { dia: hojeBr(), ganhadores: [] };
  try { d = JSON.parse(fs.readFileSync(AOVIVO_FILE, 'utf8')); } catch (e) { /* primeiro uso */ }
  if (d.dia !== hojeBr()) d = { dia: hojeBr(), ganhadores: [] };
  return d;
}
function gravarAoVivo(d) { fs.writeFileSync(AOVIVO_FILE, JSON.stringify(d)); }
let ultimoAoVivo = null; // {hora, treinando, elegiveis}

/* Participantes do sorteio geral = lista do telão (participantes.js). O controle consulta a lista e pode
   EXCLUIR alguém: os excluídos ficam em excluidos.json e o telão (e o ao vivo) deixam de sortear essas pessoas. */
const PART_FILE = process.env.SORTEIO_PARTICIPANTES || '/var/www/oxcloud-sorteio/participantes.js';
const EXCL_FILE = path.join(__dirname, 'excluidos.json');
const normNome = (s) => String(s).trim().toLowerCase();
function lerParticipantes() {
  try {
    const t = fs.readFileSync(PART_FILE, 'utf8');
    const m = t.match(/`([\s\S]*)`/);
    return (m ? m[1] : '').split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (e) { return []; }
}
function lerExcluidos() { try { return JSON.parse(fs.readFileSync(EXCL_FILE, 'utf8')); } catch (e) { return []; } }
function gravarExcluidos(l) { fs.writeFileSync(EXCL_FILE, JSON.stringify(l)); }
const STATUS = new Set(['idle', 'running', 'finished']);

const st = {
  seq: 0,
  cmds: [],            // {seq, cmd}, últimos 30
  state: { status: 'idle', muted: false, manual: false, title: '', eyebrow: '', winners: [] },
  aovivoSeq: 0,        // seq do último sorteio ao vivo enviado ao telão
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
      // telão informa o ganhador do sorteio ao vivo (uma vez por sorteio)
      const w = s.aovivoWin;
      if (w && Number.isInteger(w.seq) && w.seq === st.aovivoSeq && typeof w.nome === 'string') {
        const av = lerAoVivo();
        if (!av.ganhadores.some((g) => g.seq === w.seq)) {
          av.ganhadores.push({ seq: w.seq, id: Number(w.id) || null, nome: str(w.nome, 80), hora: new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 16) });
          gravarAoVivo(av);
        }
      }
      const since = Number.isInteger(d.since) ? d.since : null;
      json(res, { seq: st.seq, cmds: since === null ? [] : st.cmds.filter((c) => c.seq > since), excluidos: lerExcluidos().map((x) => x.nome) });
    });
  }

  if (p === '/state') {                                    // celular
    const av = lerAoVivo();
    return json(res, { ...st.state, telao: Date.now() - st.lastSync < 5000, aovivo: { ganhadores: av.ganhadores, ultimo: ultimoAoVivo } });
  }

  // participantes do sorteio geral (celular): lista + quem já ganhou + quem foi excluído
  if (p === '/participantes') {
    if (u.searchParams.get('k') !== KEY) return json(res, { error: 'chave invalida' }, 403);
    const excl = lerExcluidos();
    const ex = new Set(excl.map((x) => normNome(x.nome)));
    const ganhou = new Set(st.state.winners.map(normNome));
    const lista = lerParticipantes().map((nome) => ({ nome, ganhou: ganhou.has(normNome(nome)), excluido: ex.has(normNome(nome)) }));
    return json(res, { total: lista.length, concorrendo: lista.filter((x) => !x.ganhou && !x.excluido).length, lista, excluidos: excl });
  }
  if (req.method === 'POST' && (p === '/excluir' || p === '/restaurar')) {
    if (u.searchParams.get('k') !== KEY) return json(res, { error: 'chave invalida' }, 403);
    const nome = str(u.searchParams.get('nome') || '', 80).trim();
    if (!nome) return json(res, { error: 'informe o nome' }, 400);
    let excl = lerExcluidos().filter((x) => normNome(x.nome) !== normNome(nome));
    if (p === '/excluir') excl.push({ nome, em: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') });
    gravarExcluidos(excl);
    return json(res, { ok: 1, excluidos: excl.length });
  }

  if (req.method === 'POST' && p === '/cmd') {             // celular
    if (u.searchParams.get('k') !== KEY) return json(res, { error: 'chave invalida' }, 403);
    const c = u.searchParams.get('c');
    if (!CMDS.has(c)) return json(res, { error: 'comando invalido' }, 400);
    const now = Date.now();
    if (now - (st.lastCmd[c] || 0) < 800) return json(res, { ok: 0, motivo: 'aguarde' });
    st.lastCmd[c] = now;
    if (c === 'aovivo') return aoVivo(res);
    st.seq++;
    st.cmds.push({ seq: st.seq, cmd: c });
    if (st.cmds.length > 30) st.cmds.shift();
    return json(res, { ok: 1, seq: st.seq });
  }

  json(res, { error: 'nao encontrado' }, 404);
}).listen(8410, '127.0.0.1');

/** Busca quem está treinando, tira quem já ganhou hoje e manda a lista ao telão. */
async function aoVivo(res) {
  let dados;
  try {
    const r = await fetch(OX_TREINANDO, { signal: AbortSignal.timeout(20000) });
    dados = await r.json();
    if (!r.ok) throw new Error(dados && dados.erro || ('HTTP ' + r.status));
  } catch (e) {
    return json(res, { ok: 0, motivo: 'Não consegui consultar a catraca da EVO: ' + (e.message || 'erro') }, 502);
  }
  const av = lerAoVivo();
  const ja = new Set(av.ganhadores.map((g) => g.id).filter(Boolean));
  const jaNome = new Set(av.ganhadores.map((g) => g.nome.toLowerCase()));
  const excl = new Set(lerExcluidos().map((x) => normNome(x.nome)));
  const elegiveis = (dados.treinando || []).filter((p) => !ja.has(p.idMember) && !jaNome.has(p.nome.toLowerCase()) && !excl.has(normNome(p.nome)));
  ultimoAoVivo = { hora: dados.hora, treinando: (dados.treinando || []).length, elegiveis: elegiveis.length };
  st.seq++;
  st.aovivoSeq = st.seq;
  st.cmds.push({ seq: st.seq, cmd: 'aovivo', lista: elegiveis.map((p) => ({ id: p.idMember, nome: p.nome })), treinando: ultimoAoVivo.treinando });
  if (st.cmds.length > 30) st.cmds.shift();
  return json(res, { ok: 1, seq: st.seq, ...ultimoAoVivo });
}
