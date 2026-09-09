/* Imersão Bravos — inscrição com pagamento Mercado Pago (PIX inline + cartão via Checkout Pro) */
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
const PUBLIC_BASE = process.env.PUBLIC_BASE || 'https://abarimigreja.com.br/imersao';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const GRUPO = process.env.GRUPO_WHATSAPP || '';
const VALOR = Number(process.env.VALOR || '89.90');
const MAX_PARCELAS = Number(process.env.MAX_PARCELAS || '3');
// taxa do cartão do Mercado Pago (ex.: 0.0499 = 4,99%); usada só no cartão pra repassar ao cliente
const TAXA_CARTAO = Number(process.env.TAXA_CARTAO || '0.0499');
const VALOR_CARTAO = Number((VALOR / (1 - TAXA_CARTAO)).toFixed(2));
const PORT = Number(process.env.PORT || '8402');
const DB = path.join(__dirname, 'data', 'inscritos.json');

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
      description: 'Imersão Bravos — O Caráter de Davi',
      payment_method_id: 'pix',
      notification_url: `${PUBLIC_BASE}/api/webhook`,
      external_reference: id,
      payer: { email, first_name: nomePrimeiro, last_name: resto.join(' ') || 'Bravos' },
    }),
  });
  if (!r.ok) { console.error('MP pix erro', r.status, r.body); return res.status(502).json({ error: 'falha_pix', detalhe: r.body.message }); }

  const tx = r.body.point_of_interaction?.transaction_data || {};
  db[id] = { id, nome, email, whatsapp, valor: VALOR, metodo: 'pix', mp_id: r.body.id,
    status: 'pending', criado: new Date().toISOString(), pago: null };
  save();
  res.json({ id, qr_code: tx.qr_code, qr_code_base64: tx.qr_code_base64, expira: tx.expiration_date });
});

// cartão → cria preferência do Checkout Pro e devolve o link
app.post('/api/cartao', async (req, res) => {
  if (!TOKEN) return res.status(503).json({ error: 'pagamento_nao_configurado' });
  const nome = (req.body.nome || '').trim();
  const email = (req.body.email || '').trim();
  const whatsapp = digits(req.body.whatsapp);
  if (!ok(nome) || !/.+@.+\..+/.test(email) || whatsapp.length < 10)
    return res.status(400).json({ error: 'dados_invalidos' });
  const id = crypto.randomUUID();
  const r = await mp('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ title: 'Imersão Bravos — O Caráter de Davi', quantity: 1, unit_price: VALOR_CARTAO, currency_id: 'BRL' }],
      payer: { name: nome, email },
      external_reference: id,
      notification_url: `${PUBLIC_BASE}/api/webhook`,
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }],
        installments: MAX_PARCELAS,
        default_installments: 1,
      },
      back_urls: { success: `${PUBLIC_BASE}/obrigado/`, pending: `${PUBLIC_BASE}/obrigado/`, failure: `${PUBLIC_BASE}/#inscricao` },
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
    if (r.ok && r.body.status === 'approved') { rec.status = 'approved'; rec.pago = new Date().toISOString(); save(); }
  }
  res.json({ status: rec.status, grupo: rec.status === 'approved' ? GRUPO : undefined });
});

// webhook do Mercado Pago
app.post('/api/webhook', async (req, res) => {
  res.sendStatus(200); // responde rápido; processa depois
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'];
    const type = req.body?.type || req.query.type;
    if (type !== 'payment' || !paymentId || !TOKEN) return;
    const r = await mp('/v1/payments/' + paymentId);
    if (!r.ok) return;
    const ref = r.body.external_reference;
    const rec = db[ref];
    if (rec) {
      rec.mp_id = paymentId;
      if (r.body.status === 'approved' && rec.status !== 'approved') { rec.status = 'approved'; rec.pago = new Date().toISOString(); }
      else if (rec.status === 'pending') rec.status = r.body.status;
      save();
    }
  } catch (e) { console.error('webhook', e); }
});

// painel de inscritos (protegido por ?key=)
app.get('/api/admin', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).send('nao autorizado');
  const list = Object.values(db).sort((a, b) => (b.criado || '').localeCompare(a.criado || ''));
  const pagos = list.filter(r => r.status === 'approved');
  if (req.query.csv) {
    const rows = [['nome', 'whatsapp', 'email', 'status', 'metodo', 'criado', 'pago'],
      ...list.map(r => [r.nome, r.whatsapp, r.email, r.status, r.metodo, r.criado, r.pago || ''])];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=inscritos-bravos.csv');
    return res.send('﻿' + rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(';')).join('\n'));
  }
  const rowsHtml = list.map(r => '<tr><td>' + esc(r.nome) + '</td><td>' + esc(r.whatsapp) + '</td><td>' + esc(r.email) +
    '</td><td class="' + (r.status === 'approved' ? 'ok' : 'pend') + '">' + (r.status === 'approved' ? 'PAGO' : esc(r.status)) +
    '</td><td>' + esc(r.metodo) + '</td></tr>').join('');
  const style = 'body{font-family:system-ui;background:#0f0e10;color:#e8e2d6;margin:0;padding:24px}h1{font-size:1.3rem}' +
    '.tot{color:#D9AC45;font-weight:700}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:.9rem}' +
    'th,td{text-align:left;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08)}tr:hover{background:rgba(255,255,255,.04)}' +
    '.ok{color:#5cd67a}.pend{color:#c9a24a}a.btn{display:inline-block;margin-top:8px;color:#0f0e10;background:#D9AC45;padding:8px 16px;border-radius:4px;text-decoration:none;font-weight:700}';
  res.send('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">' +
    '<title>Inscritos Bravos</title><style>' + style + '</style>' +
    '<h1>Imersão Bravos — <span class=tot>' + pagos.length + ' pagos</span> · ' + list.length + ' no total</h1>' +
    '<a class=btn href="?key=' + encodeURIComponent(req.query.key) + '&csv=1">Baixar planilha (CSV)</a>' +
    '<table><tr><th>Nome</th><th>WhatsApp</th><th>E-mail</th><th>Status</th><th>Método</th></tr>' + rowsHtml + '</table>');
});

app.listen(PORT, '127.0.0.1', () => console.log('bravos inscrição :' + PORT + ' · pagamento ' + (TOKEN ? 'ATIVO' : 'nao configurado')));
