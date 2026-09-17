/* Conferência Diamond — inscrição com pagamento Mercado Pago (PIX inline + cartão via Checkout Pro)
   Pós-pagamento AUTOMÁTICO pelo WhatsApp da pastora (Evolution API): entra no grupo + texto + áudio como mensagem de voz. */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// carrega .env manualmente (sem dependência)
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const TOKEN = process.env.MP_ACCESS_TOKEN || '';
const PUBLIC_BASE = process.env.PUBLIC_BASE || 'https://abarimigreja.com.br/diamond';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const GRUPO = process.env.GRUPO_WHATSAPP || '';
const VALOR = Number(process.env.VALOR || '30.00');
const MAX_PARCELAS = Number(process.env.MAX_PARCELAS || '1');
// taxa do cartão do Mercado Pago — repassada INTEIRA ao cliente (cai o valor limpo pra igreja)
const TAXA_CARTAO = Number(process.env.TAXA_CARTAO || '0.0498');
const VALOR_CARTAO = Number((VALOR / (1 - TAXA_CARTAO)).toFixed(2));
const PORT = Number(process.env.PORT || '8403');
const DB = path.join(__dirname, 'data', 'inscritos.json');
const MEDIA = path.join(__dirname, 'media');

const TITULO = 'Conferência Diamond';
const DESCRICAO = 'Inscrição individual · 23 e 24/10/2026 · Igreja Abarim, Imbituba/SC';

fs.mkdirSync(path.dirname(DB), { recursive: true });
const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
let writing = Promise.resolve();
const db = load();
const save = () => { writing = writing.then(() => fs.promises.writeFile(DB, JSON.stringify(db, null, 2))); return writing; };

const mp = (endpoint, opts = {}) => fetch('https://api.mercadopago.com' + endpoint, {
  ...opts,
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
}).then(async r => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }));

const app = express();
app.use(express.json());
app.set('trust proxy', true);

const digits = s => String(s || '').replace(/\D/g, '');
const ok = v => typeof v === 'string' && v.trim().length > 1;
const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&' + 'lt;', '>': '&' + 'gt;', '&': '&' + 'amp;', '"': '&' + 'quot;' }[c]));
const admin = (req, res) => { if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) { res.status(401).json({ error: 'nao_autorizado' }); return false; } return true; };

// estado da configuração — o front usa pra decidir se abre o formulário ou cai no WhatsApp
app.get('/api/config', (_req, res) => res.json({ enabled: !!TOKEN, valor: VALOR, valorCartao: VALOR_CARTAO, maxParcelas: MAX_PARCELAS }));

// cria a inscrição + cobrança PIX
app.post('/api/inscrever', async (req, res) => {
  if (!TOKEN) return res.status(503).json({ error: 'pagamento_nao_configurado' });
  const nome = (req.body.nome || '').trim();
  const email = (req.body.email || '').trim();
  const whatsapp = digits(req.body.whatsapp);
  if (!ok(nome) || !/.+@.+\..+/.test(email) || whatsapp.length < 10)
    return res.status(400).json({ error: 'dados_invalidos' });

  const id = crypto.randomUUID();
  const [nomePrimeiro, ...resto] = nome.split(' ');
  const r = await mp('/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': id },
    body: JSON.stringify({
      transaction_amount: VALOR,
      description: TITULO + ' — Olharam para Ele',
      payment_method_id: 'pix',
      notification_url: `${PUBLIC_BASE}/api/webhook`,
      external_reference: id,
      payer: { email, first_name: nomePrimeiro, last_name: resto.join(' ') || 'Diamond' },
    }),
  });
  if (!r.ok) { console.error('MP pix erro', r.status, r.body); return res.status(502).json({ error: 'falha_pix', detalhe: r.body.message }); }

  const tx = r.body.point_of_interaction?.transaction_data || {};
  db[id] = { id, nome, email, whatsapp, valor: VALOR, metodo: 'pix', mp_id: r.body.id,
    status: 'pending', criado: new Date().toISOString(), pago: null };
  save();
  res.json({ id, qr_code: tx.qr_code, qr_code_base64: tx.qr_code_base64, expira: tx.expiration_date });
});

// cartão → preferência do Checkout Pro (valor com as taxas repassadas)
app.post('/api/cartao', async (req, res) => {
  if (!TOKEN) return res.status(503).json({ error: 'pagamento_nao_configurado' });
  const nome = (req.body.nome || '').trim();
  const email = (req.body.email || '').trim();
  const whatsapp = digits(req.body.whatsapp);
  if (!ok(nome) || !/.+@.+\..+/.test(email) || whatsapp.length < 10)
    return res.status(400).json({ error: 'dados_invalidos' });
  const id = crypto.randomUUID();
  const [pnome, ...psobre] = nome.split(' ');
  const sobrenome = psobre.join(' ') || pnome;
  const ddd = whatsapp.slice(0, 2), fone = whatsapp.slice(2);
  const itens = [{
    id: 'diamond-2026', title: TITULO, description: DESCRICAO,
    category_id: 'services', quantity: 1, unit_price: VALOR_CARTAO, currency_id: 'BRL',
  }];
  const r = await mp('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: itens,
      payer: { name: pnome, surname: sobrenome, email, phone: { area_code: ddd, number: fone } },
      additional_info: { items: itens, payer: { first_name: pnome, last_name: sobrenome, phone: { area_code: ddd, number: fone } } },
      statement_descriptor: 'CONFDIAMOND',
      binary_mode: false,
      external_reference: id,
      notification_url: `${PUBLIC_BASE}/api/webhook`,
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }],
        installments: MAX_PARCELAS,
        default_installments: 1,
      },
      back_urls: { success: `${PUBLIC_BASE}/obrigado/`, pending: `${PUBLIC_BASE}/obrigado/`, failure: `${PUBLIC_BASE}/?pagamento=falhou` },
      auto_return: 'approved',
    }),
  });
  if (!r.ok) { console.error('MP pref erro', r.status, r.body); return res.status(502).json({ error: 'falha_cartao' }); }
  db[id] = { id, nome, email, whatsapp, valor: VALOR_CARTAO, metodo: 'cartao', mp_id: null,
    status: 'pending', criado: new Date().toISOString(), pago: null };
  save();
  res.json({ id, init_point: r.body.init_point });
});

// front pergunta o status enquanto o PIX não confirma
app.get('/api/status/:id', async (req, res) => {
  const rec = db[req.params.id];
  if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  if (rec.status !== 'approved' && rec.mp_id && TOKEN) {
    const r = await mp('/v1/payments/' + rec.mp_id);
    if (r.ok && r.body.status === 'approved') aprovar(rec);
  }
  res.json({ status: rec.status, grupo: rec.status === 'approved' ? GRUPO : undefined });
});

// webhook do Mercado Pago
app.post('/api/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'];
    const type = req.body?.type || req.query.type;
    if (type !== 'payment' || !paymentId || !TOKEN) return;
    const r = await mp('/v1/payments/' + paymentId);
    if (!r.ok) return;
    const rec = db[r.body.external_reference];
    if (rec) {
      rec.mp_id = paymentId;
      if (r.body.status === 'approved') aprovar(rec);
      else if (rec.status === 'pending') { rec.status = r.body.status; save(); }
    }
  } catch (e) { console.error('webhook', e); }
});

// marca como pago (uma vez só) e dispara o pós-pagamento automático
function aprovar(rec) {
  if (rec.status === 'approved') return;
  rec.status = 'approved'; rec.pago = new Date().toISOString();
  limparPendentes(rec);
  save();
  posPagamento(rec).catch(e => console.error('posPagamento', e));
}

// ── WhatsApp da PASTORA (Evolution API) ───────────────────────────────────
const EVO_URL = process.env.EVOLUTION_URL || 'http://127.0.0.1:8081';
const EVO_KEY = process.env.EVOLUTION_KEY || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'diamond';   // instância pareada no celular da pastora
let grupoJid = process.env.GRUPO_JID || '';
const GRUPO_CODE = (String(GRUPO).match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/) || [])[1] || '';

// timeout curto: com a instância desconectada a Evolution pode segurar a requisição por minutos
const evo = (p, opts = {}) => fetch(EVO_URL + p, {
  ...opts, headers: { apikey: EVO_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  signal: AbortSignal.timeout(opts.timeout || 8000),
}).then(async r => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }));

const chaveFone = s => { const d = digits(s).replace(/^55/, ''); return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d; };
const numeroZap = rec => '55' + digits(rec.whatsapp).replace(/^55/, '');
const primeiroNome = rec => String(rec.nome || '').split(' ')[0] || '';
const dormir = ms => new Promise(r => setTimeout(r, ms));

function limparPendentes(rec) {
  const chave = chaveFone(rec.whatsapp), mail = String(rec.email || '').toLowerCase();
  let n = 0;
  for (const [id, r] of Object.entries(db)) {
    if (id === rec.id || r.status !== 'pending') continue;
    if ((chave && chaveFone(r.whatsapp) === chave) || (mail && String(r.email || '').toLowerCase() === mail)) { delete db[id]; n++; }
  }
  if (n) console.log(`limpou ${n} pendente(s) de ${rec.nome}`);
}

let grupoCache = { at: 0, data: null }, grupoNome = '';
async function grupoInfo(forcar) {
  if (!EVO_KEY) return null;
  if (!forcar && grupoCache.data && Date.now() - grupoCache.at < 60000) return grupoCache.data;
  try {
    if ((!grupoJid || !grupoNome) && GRUPO_CODE) {
      const b = (await evo(`/group/inviteInfo/${EVO_INSTANCE}?inviteCode=${GRUPO_CODE}`)).body;
      if (b && b.id) { grupoJid = b.id; grupoNome = b.subject || grupoNome; }
    }
    if (!grupoJid) return grupoCache.data;
    const b = (await evo(`/group/participants/${EVO_INSTANCE}?groupJid=${encodeURIComponent(grupoJid)}`)).body;
    const parts = (b && b.participants) || [];
    if (!parts.length) return grupoCache.data;
    const data = { nome: grupoNome || 'Grupo da Conferência', total: parts.length, membros: parts.map(p => chaveFone(p.phoneNumber || p.id)) };
    grupoCache = { at: Date.now(), data };
    return data;
  } catch (e) { console.error('grupo', e.message); return grupoCache.data; }
}

// adiciona no grupo; devolve um código legível
async function adicionarNoGrupo(rec) {
  if (!EVO_KEY) return 'evolution_nao_configurado';
  await grupoInfo(true);
  if (!grupoJid) return 'grupo_indisponivel';
  const r = await evo(`/group/updateParticipant/${EVO_INSTANCE}?groupJid=${encodeURIComponent(grupoJid)}`, {
    method: 'POST', body: JSON.stringify({ action: 'add', participants: [numeroZap(rec)] }),
  });
  const b = r.body || {};
  const item = (b.updateParticipants || b.add || b.participants || b.result || [])[0] || {};
  const st = String(item.status || b.status || r.status);
  grupoCache = { at: 0, data: null };
  if (st === '200' || st === 'success') return 'adicionado';
  if (st === '409') return 'ja_no_grupo';
  if (st === '403') return 'privacidade';
  if (st === '408') return 'saiu_recente';
  if (st === '401') return 'bloqueou';
  return 'falhou:' + JSON.stringify(b).slice(0, 160);
}

const textoConfirmacao = rec =>
  `Oi, ${primeiroNome(rec)}! Sua inscrição na *Conferência Diamond* está confirmada. ✨\n\n` +
  `📅 Sexta 23/10 às 19h30 · Sábado 24/10 às 16h e 19h\n📍 Igreja Abarim — Av. 21 de Junho, 288, Centro, Imbituba/SC\n\n` +
  (GRUPO ? `Entre no nosso grupo das inscritas pelo link abaixo 👇 é por lá que vamos passar todos os avisos:\n${GRUPO}` : `Em breve você recebe o link do grupo das inscritas.`);

async function enviarTexto(rec) {
  if (!EVO_KEY) return 'evolution_nao_configurado';
  const r = await evo(`/message/sendText/${EVO_INSTANCE}`, {
    method: 'POST', body: JSON.stringify({ number: numeroZap(rec), text: textoConfirmacao(rec), delay: 1200 }),
  });
  return (r.ok && r.body && r.body.key) ? 'enviado' : 'falhou:' + ((r.body && (r.body.message || r.body.error)) || r.status);
}

// o áudio da pastora vai como MENSAGEM DE VOZ (PTT) — com "gravando áudio…" antes, parece feito na hora
function arquivoAudio() {
  try {
    const f = fs.readdirSync(MEDIA).find(n => /^audio-pastora\.(ogg|opus|mp3|m4a|aac|wav)$/i.test(n));
    return f ? path.join(MEDIA, f) : null;
  } catch { return null; }
}
async function enviarAudio(rec) {
  if (!EVO_KEY) return 'evolution_nao_configurado';
  const f = arquivoAudio();
  if (!f) return 'sem_audio';
  const b64 = fs.readFileSync(f).toString('base64');
  await evo(`/chat/sendPresence/${EVO_INSTANCE}`, {
    method: 'POST', body: JSON.stringify({ number: numeroZap(rec), presence: 'recording', delay: 6000 }),
  }).catch(() => {});
  await dormir(6000);
  const r = await evo(`/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
    method: 'POST', body: JSON.stringify({ number: numeroZap(rec), audio: b64, encoding: true }), timeout: 60000,
  });
  return (r.ok && r.body && r.body.key) ? 'enviado' : 'falhou:' + ((r.body && (r.body.message || JSON.stringify(r.body.response || r.body.error))) || r.status).toString().slice(0, 160);
}

// fluxo automático após o pagamento: grupo → texto → áudio (com pausas naturais)
const filaPos = [];
let rodandoPos = false;
// ADICIONAR_GRUPO=0 no .env => NÃO adiciona a pessoa no grupo automaticamente;
// só envia o CONVITE por mensagem (o texto já traz o link do grupo) + o áudio.
const ADD_GRUPO = process.env.ADICIONAR_GRUPO !== '0';
async function posPagamento(rec) {
  filaPos.push(rec);
  if (rodandoPos) return;
  rodandoPos = true;
  try {
    while (filaPos.length) {
      const r = filaPos.shift();
      r.pos = r.pos || {};
      if (ADD_GRUPO) {
        try { r.pos.grupo = await adicionarNoGrupo(r); } catch (e) { r.pos.grupo = 'falhou:' + e.message; }
      } else {
        r.pos.grupo = 'convite'; // não adiciona; convida por mensagem
      }
      save();
      await dormir(2500);
      try { r.pos.texto = await enviarTexto(r); } catch (e) { r.pos.texto = 'falhou:' + e.message; }
      save();
      await dormir(3000);
      try { r.pos.audio = await enviarAudio(r); } catch (e) { r.pos.audio = 'falhou:' + e.message; }
      r.pos.em = new Date().toISOString();
      save();
      console.log(`[pos] ${r.nome}: grupo=${r.pos.grupo} texto=${r.pos.texto} audio=${r.pos.audio}`);
      await dormir(4000);
    }
  } finally { rodandoPos = false; }
}

// ── painel (JSON) ─────────────────────────────────────────────────────────
app.get('/api/painel', async (req, res) => {
  if (!admin(req, res)) return;
  const g = await grupoInfo(req.query.atualizar === '1');
  const membros = new Set(g?.membros || []);
  let n = 0;
  const list = Object.values(db)
    .sort((a, b) => (a.criado || '').localeCompare(b.criado || ''))
    .map(r => ({ ...r, ordem: r.status === 'approved' ? ++n : null, noGrupo: membros.size ? membros.has(chaveFone(r.whatsapp)) : null }));
  const pagos = list.filter(r => r.status === 'approved');
  let zap = { estado: 'nao_configurado' };
  if (EVO_KEY) {
    try { const s = (await evo(`/instance/connectionState/${EVO_INSTANCE}`)).body; zap = { estado: (s && s.instance && s.instance.state) || 'desconhecido' }; }
    catch { zap = { estado: 'erro' }; }
  }
  res.json({
    grupo: g ? { nome: g.nome, total: g.total, link: GRUPO } : null,
    whatsapp: { ...zap, instancia: EVO_INSTANCE, audio: !!arquivoAudio() },
    resumo: {
      total: list.length, pagos: pagos.length,
      pendentes: list.filter(r => r.status === 'pending').length,
      arrecadado: pagos.reduce((s, r) => s + Number(r.valor || 0), 0),
      noGrupo: pagos.filter(r => r.noGrupo === true).length,
      foraGrupo: pagos.filter(r => r.noGrupo === false).length,
    },
    inscritos: list,
  });
});

// lançamento manual (pagou fora do site) — dispara o mesmo pós-pagamento
app.post('/api/manual', (req, res) => {
  if (!admin(req, res)) return;
  const nome = (req.body.nome || '').trim();
  const email = (req.body.email || '').trim();
  const whatsapp = digits(req.body.whatsapp);
  const metodo = ['dinheiro', 'pix', 'cartao', 'transferencia'].includes(req.body.metodo) ? req.body.metodo : 'dinheiro';
  const valor = Number(req.body.valor) || VALOR;
  if (!ok(nome) || whatsapp.length < 10) return res.status(400).json({ error: 'dados_invalidos' });
  const id = crypto.randomUUID();
  const rec = { id, nome, email, whatsapp, valor, metodo, mp_id: null, status: 'pending', criado: new Date().toISOString(), pago: null, manual: true };
  db[id] = rec;
  aprovar(rec);
  res.json({ ok: true, inscrito: rec });
});

// edita o inscrito
app.patch('/api/inscrito/:id', (req, res) => {
  if (!admin(req, res)) return;
  const rec = db[req.params.id];
  if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  if (req.body.whatsapp !== undefined) {
    const w = digits(req.body.whatsapp);
    if (w.length < 10) return res.status(400).json({ error: 'telefone_invalido' });
    rec.whatsapp = w;
  }
  if (ok(req.body.nome)) rec.nome = String(req.body.nome).trim();
  if (req.body.email && /.+@.+\..+/.test(req.body.email)) rec.email = String(req.body.email).trim();
  save();
  res.json({ ok: true, inscrito: rec });
});

// ações manuais do painel (repetir qualquer passo do pós-pagamento)
app.post('/api/grupo/adicionar', async (req, res) => {
  if (!admin(req, res)) return;
  const rec = db[req.body.id]; if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  try { const r = await adicionarNoGrupo(rec); rec.pos = { ...(rec.pos || {}), grupo: r }; save();
    res.json({ ok: r === 'adicionado' || r === 'ja_no_grupo', resultado: r }); }
  catch (e) { res.status(502).json({ error: 'falha_evolution', detalhe: e.message }); }
});
app.post('/api/convite', async (req, res) => {
  if (!admin(req, res)) return;
  const rec = db[req.body.id]; if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  try { const r = await enviarTexto(rec); rec.pos = { ...(rec.pos || {}), texto: r }; if (r === 'enviado') rec.conviteEnviado = new Date().toISOString(); save();
    res.json({ ok: r === 'enviado', detalhe: r }); }
  catch (e) { res.status(502).json({ error: 'falha_envio', detalhe: e.message }); }
});
app.post('/api/audio', async (req, res) => {
  if (!admin(req, res)) return;
  const rec = db[req.body.id]; if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  try { const r = await enviarAudio(rec); rec.pos = { ...(rec.pos || {}), audio: r }; save(); res.json({ ok: r === 'enviado', detalhe: r }); }
  catch (e) { res.status(502).json({ error: 'falha_envio', detalhe: e.message }); }
});
// roda o fluxo completo de novo pra um inscrito
app.post('/api/pos/reenviar', async (req, res) => {
  if (!admin(req, res)) return;
  const rec = db[req.body.id]; if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  posPagamento(rec).catch(() => {});
  res.json({ ok: true, fila: true });
});

// ── conexão do WhatsApp da pastora (parear pelo painel) ───────────────────
app.get('/api/whatsapp/status', async (req, res) => {
  if (!admin(req, res)) return;
  if (!EVO_KEY) return res.json({ estado: 'nao_configurado' });
  try {
    const s = (await evo(`/instance/connectionState/${EVO_INSTANCE}`)).body;
    res.json({ estado: (s && s.instance && s.instance.state) || 'desconhecido', instancia: EVO_INSTANCE, audio: !!arquivoAudio() });
  } catch (e) { res.json({ estado: 'erro', detalhe: e.message }); }
});
// QR code pra pastora escanear (só quando desconectado)
app.get('/api/whatsapp/qr', async (req, res) => {
  if (!admin(req, res)) return;
  if (!EVO_KEY) return res.status(503).json({ error: 'nao_configurado' });
  try {
    const r = await evo(`/instance/connect/${EVO_INSTANCE}`);
    const b = r.body || {};
    if (b.instance && b.instance.state === 'open') return res.json({ estado: 'open' });
    res.json({ estado: 'aguardando', qr: b.base64 || b.qrcode?.base64 || null, code: b.code || b.pairingCode || null });
  } catch (e) { res.status(502).json({ error: 'falha', detalhe: e.message }); }
});

// vigia: se a instância cair, tenta reconectar sozinha (sessão válida volta sem QR)
let ultimoEstado = '';
async function vigiaConexao() {
  if (!EVO_KEY) return;
  try {
    const s = (await evo(`/instance/connectionState/${EVO_INSTANCE}`)).body;
    const st = (s && s.instance && s.instance.state) || 'desconhecido';
    if (st !== ultimoEstado) { console.log('[whatsapp] estado:', st); ultimoEstado = st; }
    if (st !== 'open') await evo(`/instance/connect/${EVO_INSTANCE}`).catch(() => {});
  } catch {}
}
if (EVO_KEY) { setInterval(vigiaConexao, 90000); setTimeout(vigiaConexao, 5000); }

// planilha CSV
app.get('/api/admin', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).send('nao autorizado');
  const list = Object.values(db).sort((a, b) => (a.criado || '').localeCompare(b.criado || ''));
  if (req.query.csv) {
    let nc = 0;
    const rows = [['#', 'nome', 'whatsapp', 'email', 'status', 'metodo', 'valor', 'criado', 'pago', 'grupo', 'texto', 'audio'],
      ...list.map(r => [r.status === 'approved' ? ++nc : '', r.nome, r.whatsapp, r.email, r.status, r.metodo, r.valor, r.criado, r.pago || '',
        r.pos?.grupo || '', r.pos?.texto || '', r.pos?.audio || ''])];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=inscritas-diamond.csv');
    return res.send('﻿' + rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(';')).join('\n'));
  }
  res.redirect(PUBLIC_BASE + '/painel/?key=' + encodeURIComponent(req.query.key));
});

app.listen(PORT, '127.0.0.1', () => console.log('diamond inscrição :' + PORT + ' · pagamento ' + (TOKEN ? 'ATIVO' : 'nao configurado') + ' · whatsapp ' + (EVO_KEY ? EVO_INSTANCE : 'nao configurado')));
