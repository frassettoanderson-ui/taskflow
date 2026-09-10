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
  const [pnome, ...psobre] = nome.split(' ');
  const sobrenome = psobre.join(' ') || pnome;
  const ddd = whatsapp.length > 10 ? whatsapp.slice(0, 2) : whatsapp.slice(0, 2);
  const fone = whatsapp.slice(2);
  // dados completos melhoram muito a aprovação no antifraude do Mercado Pago
  const itens = [{
    id: 'bravos-2026', title: 'Imersão Bravos — O Caráter de Davi',
    description: 'Inscrição individual · 17/10/2026 · Igreja Abarim, Imbituba/SC',
    category_id: 'services', quantity: 1, unit_price: VALOR_CARTAO, currency_id: 'BRL',
  }];
  const r = await mp('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: itens,
      payer: { name: pnome, surname: sobrenome, email, phone: { area_code: ddd, number: fone } },
      additional_info: {
        items: itens,
        payer: { first_name: pnome, last_name: sobrenome, phone: { area_code: ddd, number: fone } },
      },
      statement_descriptor: 'IMERSAOBRAVOS',
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
    if (r.ok && r.body.status === 'approved') {
      rec.status = 'approved'; rec.pago = new Date().toISOString();
      limparPendentes(rec); save();
    }
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
      if (r.body.status === 'approved' && rec.status !== 'approved') {
        rec.status = 'approved'; rec.pago = new Date().toISOString();
        limparPendentes(rec);
      }
      else if (rec.status === 'pending') rec.status = r.body.status;
      save();
    }
  } catch (e) { console.error('webhook', e); }
});

// ── grupo do WhatsApp (leitura via Evolution API) ─────────────────────────
const EVO_URL = process.env.EVOLUTION_URL || 'http://127.0.0.1:8081';
const EVO_KEY = process.env.EVOLUTION_KEY || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'nauta';
// instância do número que é ADMIN do grupo — é ela que consegue adicionar participantes
const EVO_ADD_INSTANCE = process.env.EVOLUTION_ADD_INSTANCE || 'abarim';
let grupoJid = process.env.GRUPO_JID || '';
const GRUPO_CODE = (String(GRUPO).match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/) || [])[1] || '';

// o WhatsApp guarda números BR sem o 9º dígito — compara DDD + últimos 8
const chaveFone = s => {
  const d = digits(s).replace(/^55/, '');
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d;
};

// quando um pagamento é aprovado, remove as tentativas pendentes da mesma pessoa
// (ex.: gerou o PIX, não pagou na hora, e depois se inscreveu de novo e pagou)
function limparPendentes(rec) {
  const chave = chaveFone(rec.whatsapp);
  const mail = String(rec.email || '').toLowerCase();
  let n = 0;
  for (const [id, r] of Object.entries(db)) {
    if (id === rec.id || r.status !== 'pending') continue;
    const mesmoFone = chave && chaveFone(r.whatsapp) === chave;
    const mesmoMail = mail && String(r.email || '').toLowerCase() === mail;
    if (mesmoFone || mesmoMail) { delete db[id]; n++; }
  }
  if (n) console.log(`limpou ${n} pendente(s) de ${rec.nome}`);
  return n;
}

let grupoCache = { at: 0, data: null };
let grupoNome = '';
const evo = (url) => fetch(url, { headers: { apikey: EVO_KEY } }).then(r => r.json());

async function grupoInfo(forcar) {
  if (!EVO_KEY) return null;
  if (!forcar && grupoCache.data && Date.now() - grupoCache.at < 60000) return grupoCache.data;
  try {
    // 1) descobre o id e o nome do grupo uma única vez (pelo código do convite)
    if ((!grupoJid || !grupoNome) && GRUPO_CODE) {
      const b = await evo(`${EVO_URL}/group/inviteInfo/${EVO_INSTANCE}?inviteCode=${GRUPO_CODE}`);
      if (b && b.id) { grupoJid = b.id; grupoNome = b.subject || grupoNome; }
    }
    if (!grupoJid) return grupoCache.data;

    // 2) lista de participantes pela instância que está DENTRO do grupo.
    //    O inviteInfo devolve lista incompleta — este endpoint é o confiável.
    const b = await evo(`${EVO_URL}/group/participants/${EVO_ADD_INSTANCE}?groupJid=${encodeURIComponent(grupoJid)}`);
    const parts = (b && b.participants) || [];
    if (!parts.length) return grupoCache.data;

    const data = {
      nome: grupoNome || 'Grupo da Imersão',
      total: parts.length,
      membros: parts.map(p => chaveFone(p.phoneNumber || p.id)),
    };
    grupoCache = { at: Date.now(), data };
    return data;
  } catch (e) { console.error('grupo', e.message); return grupoCache.data; }
}

// dados do painel (JSON)
app.get('/api/painel', async (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).json({ error: 'nao_autorizado' });
  const g = await grupoInfo(req.query.atualizar === '1');
  const membros = new Set(g?.membros || []);
  // ordem de inscrição: numera SÓ os pagos, em sequência (1, 2, 3...)
  let n = 0;
  const list = Object.values(db)
    .sort((a, b) => (a.criado || '').localeCompare(b.criado || ''))
    .map(r => ({
      ...r,
      ordem: r.status === 'approved' ? ++n : null,
      noGrupo: membros.size ? membros.has(chaveFone(r.whatsapp)) : null,
    }));
  const pagos = list.filter(r => r.status === 'approved');
  res.json({
    grupo: g ? { nome: g.nome, total: g.total, link: GRUPO } : null,
    resumo: {
      total: list.length,
      pagos: pagos.length,
      pendentes: list.filter(r => r.status === 'pending').length,
      arrecadado: pagos.reduce((s, r) => s + Number(r.valor || 0), 0),
      noGrupo: pagos.filter(r => r.noGrupo === true).length,
      foraGrupo: pagos.filter(r => r.noGrupo === false).length,
    },
    inscritos: list,
  });
});

// edita o inscrito (hoje: telefone, nome, e-mail)
app.patch('/api/inscrito/:id', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).json({ error: 'nao_autorizado' });
  const rec = db[req.params.id];
  if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  const w = digits(req.body.whatsapp);
  if (req.body.whatsapp !== undefined) {
    if (w.length < 10) return res.status(400).json({ error: 'telefone_invalido' });
    rec.whatsapp = w;
  }
  if (ok(req.body.nome)) rec.nome = String(req.body.nome).trim();
  if (req.body.email && /.+@.+\..+/.test(req.body.email)) rec.email = String(req.body.email).trim();
  save();
  res.json({ ok: true, inscrito: rec });
});

// adiciona o inscrito no grupo do WhatsApp (usa a instância do número admin do grupo)
app.post('/api/grupo/adicionar', async (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).json({ error: 'nao_autorizado' });
  const rec = db[req.body.id];
  if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  if (!EVO_KEY) return res.status(503).json({ error: 'evolution_nao_configurado' });

  const g = await grupoInfo(true);
  const jid = grupoJid;
  if (!jid) return res.status(503).json({ error: 'grupo_indisponivel' });

  // WhatsApp usa o número com 55 e, em geral, sem o 9º dígito para linhas antigas
  const base = digits(rec.whatsapp).replace(/^55/, '');
  const alvo = '55' + base;
  try {
    const r = await fetch(`${EVO_URL}/group/updateParticipant/${EVO_ADD_INSTANCE}?groupJid=${encodeURIComponent(jid)}`, {
      method: 'POST',
      headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', participants: [alvo] }),
    });
    const b = await r.json().catch(() => ({}));
    const item = (b.updateParticipants || b.add || b.participants || b.result || [])[0] || {};
    const st = String(item.status || b.status || r.status);
    grupoCache = { at: 0, data: null }; // força releitura na próxima consulta
    // códigos do WhatsApp para adição em grupo
    if (st === '200' || st === 'success') return res.json({ ok: true, resultado: 'adicionado' });
    if (st === '409') return res.json({ ok: true, resultado: 'ja_no_grupo' });
    if (st === '403') return res.json({ ok: false, resultado: 'privacidade' });
    if (st === '408') return res.json({ ok: false, resultado: 'saiu_recente' });
    if (st === '401') return res.json({ ok: false, resultado: 'bloqueou' });
    return res.json({ ok: false, resultado: 'falhou', detalhe: JSON.stringify(b).slice(0, 300) });
  } catch (e) {
    return res.status(502).json({ error: 'falha_evolution', detalhe: e.message });
  }
});

// painel de inscritos (protegido por ?key=)
app.get('/api/admin', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).send('nao autorizado');
  const list = Object.values(db).sort((a, b) => (a.criado || '').localeCompare(b.criado || ''));
  const pagos = list.filter(r => r.status === 'approved');
  if (req.query.csv) {
    let nc = 0;
    const rows = [['#', 'nome', 'whatsapp', 'email', 'status', 'metodo', 'criado', 'pago'],
      ...list.map(r => [r.status === 'approved' ? ++nc : '', r.nome, r.whatsapp, r.email, r.status, r.metodo, r.criado, r.pago || ''])];
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
