/* Curso Treinamento de Corrida de Rua (Academia D'Zimba, 12/12/2026)
   Inscrição com pagamento Mercado Pago (PIX na página + cartão pelo Checkout Pro).
   Pós-pagamento automático pelo WhatsApp da academia (Evolution Go): entra no grupo + mensagem de confirmação.
   Credenciamento (presença) no painel e certificado em PDF com o nome, enviado no WhatsApp. */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

// carrega .env sem dependência
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const TOKEN = process.env.MP_ACCESS_TOKEN || '';
const PUBLIC_BASE = (process.env.PUBLIC_BASE || 'https://academiadzimba.com.br/corrida').replace(/\/$/, '');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
// Venda por LOTES: "vagas:valor" separados por vírgula. Quando as vagas pagas de um lote acabam, o próximo entra sozinho.
// Cortesias não ocupam vaga de lote. Quem gerou o PIX/cartão paga o valor do lote em que gerou.
const LOTES = String(process.env.LOTES || '30:99.90,30:119.90,30:139.90').split(',').map(s => s.trim()).filter(Boolean)
  .map((s, i) => { const [v, p] = s.split(':'); return { numero: i + 1, vagas: Number(v), valor: Number(p) }; })
  .filter(l => l.vagas > 0 && l.valor > 0);
const MAX_PARCELAS = Number(process.env.MAX_PARCELAS || '1');
const TAXA_CARTAO = Number(process.env.TAXA_CARTAO || '0.0498');   // repassada inteira a quem paga no cartão
const VAGAS = LOTES.reduce((s, l) => s + l.vagas, 0);
const PORT = Number(process.env.PORT || '8404');
const SEGREDO = process.env.SEGREDO || ADMIN_KEY || 'dzimba';        // assina os links públicos dos certificados
const CERT_AUTO_EM = process.env.CERT_AUTO_EM || '2026-12-12T19:30:00-03:00'; // envio automático dos certificados
const DATA = path.join(__dirname, 'data');
const DB = path.join(DATA, 'inscritos.json');
const CFG = path.join(DATA, 'config.json');
const ASSETS = path.join(__dirname, 'assets');

const TITULO = 'Curso Treinamento de Corrida de Rua';
const DESCRICAO = 'Do iniciante ao avançado · 12/12/2026 · Academia D\'Zimba, Imbituba/SC';

fs.mkdirSync(DATA, { recursive: true });
const lerJson = (f, pad) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return pad; } };
const db = lerJson(DB, {});
const cfg = lerJson(CFG, {});      // { grupoJid, grupoNome, grupoLink } escolhidos no painel
let gravando = Promise.resolve();
const save = () => { gravando = gravando.then(() => fs.promises.writeFile(DB, JSON.stringify(db, null, 2))); return gravando; };
const saveCfg = () => fs.promises.writeFile(CFG, JSON.stringify(cfg, null, 2));

const mp = (endpoint, opts = {}) => fetch('https://api.mercadopago.com' + endpoint, {
  ...opts,
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
}).then(async r => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }));

const app = express();
app.use(express.json());
app.set('trust proxy', true);

const digits = s => String(s || '').replace(/\D/g, '');
const ok = v => typeof v === 'string' && v.trim().length > 1;
const admin = (req, res) => { if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) { res.status(401).json({ error: 'nao_autorizado' }); return false; } return true; };
const NIVEIS = ['iniciante', 'intermediario', 'avancado'];
const pagos = () => Object.values(db).filter(r => r.status === 'approved' && !r.oculto);
const vendidos = () => pagos().filter(r => r.metodo !== 'cortesia').length;
const esgotado = () => vendidos() >= VAGAS;
function loteAtual() {   // { numero, vagas, valor, restantes } ou null se acabou
  let n = vendidos();
  for (const l of LOTES) { if (n < l.vagas) return { ...l, restantes: l.vagas - n }; n -= l.vagas; }
  return null;
}
const valorAtual = () => (loteAtual() || LOTES[LOTES.length - 1]).valor;
const valorCartao = v => Number((v / (1 - TAXA_CARTAO)).toFixed(2));

function cpfValido(c) {
  c = digits(c);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[n])) return false;
  }
  return true;
}
// CPF vai para o Mercado Pago: sem ele o antifraude não confere o comprador e recusa mais cartões
const identificacao = d => (d.cpf ? { identification: { type: 'CPF', number: d.cpf } } : {});

function lerInscricao(body) {
  const nome = String(body.nome || '').trim().replace(/\s+/g, ' ');
  const email = String(body.email || '').trim();
  const whatsapp = digits(body.whatsapp);
  const nivel = NIVEIS.includes(body.nivel) ? body.nivel : '';
  const cpf = digits(body.cpf);
  if (!ok(nome) || nome.split(' ').length < 2 || !/.+@.+\..+/.test(email) || whatsapp.length < 10 || !cpfValido(cpf)) return null;
  const patrocinadores = body.patrocinadores === true;   // autorização expressa (LGPD): só vale marcada pela própria pessoa
  return { nome, email, whatsapp, cpf, nivel, patrocinadores, ...(patrocinadores ? { patrocinadoresEm: new Date().toISOString() } : {}) };
}

// o front usa pra decidir se abre o formulário ou cai no WhatsApp
// só o valor do lote ATUAL é público; os próximos aparecem só como "valor maior"
app.get('/api/config', (_req, res) => {
  const l = loteAtual(), v = valorAtual();
  res.json({
    enabled: !!TOKEN, valor: v, valorCartao: valorCartao(v), maxParcelas: MAX_PARCELAS,
    lote: l ? { numero: l.numero, restantes: l.restantes, vagas: l.vagas } : null, totalLotes: LOTES.length, esgotado: esgotado(),
  });
});

// cria a inscrição + cobrança PIX
app.post('/api/inscrever', async (req, res) => {
  if (!TOKEN) return res.status(503).json({ error: 'pagamento_nao_configurado' });
  if (esgotado()) return res.status(409).json({ error: 'esgotado', detalhe: 'As vagas acabaram.' });
  const d = lerInscricao(req.body);
  if (!d) return res.status(400).json({ error: 'dados_invalidos' });
  const id = crypto.randomUUID();
  const VALOR = valorAtual(), LOTE = loteAtual()?.numero || null;
  const [primeiro, ...resto] = d.nome.split(' ');
  const r = await mp('/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': id },
    body: JSON.stringify({
      transaction_amount: VALOR,
      description: TITULO,
      payment_method_id: 'pix',
      notification_url: `${PUBLIC_BASE}/api/webhook`,
      external_reference: id,
      payer: { email: d.email, first_name: primeiro, last_name: resto.join(' '), ...identificacao(d) },
    }),
  });
  if (!r.ok) { console.error('MP pix erro', r.status, r.body); return res.status(502).json({ error: 'falha_pix', detalhe: r.body.message }); }
  const tx = r.body.point_of_interaction?.transaction_data || {};
  db[id] = { id, ...d, valor: VALOR, lote: LOTE, metodo: 'pix', mp_id: r.body.id, status: 'pending', criado: new Date().toISOString(), pago: null };
  save();
  res.json({ id, qr_code: tx.qr_code, qr_code_base64: tx.qr_code_base64, expira: tx.expiration_date });
});

// cartão → Checkout Pro (taxa repassada)
app.post('/api/cartao', async (req, res) => {
  if (!TOKEN) return res.status(503).json({ error: 'pagamento_nao_configurado' });
  if (esgotado()) return res.status(409).json({ error: 'esgotado', detalhe: 'As vagas acabaram.' });
  const d = lerInscricao(req.body);
  if (!d) return res.status(400).json({ error: 'dados_invalidos' });
  const id = crypto.randomUUID();
  const VALOR_CARTAO = valorCartao(valorAtual()), LOTE = loteAtual()?.numero || null;
  const [pnome, ...psobre] = d.nome.split(' ');
  const sobrenome = psobre.join(' ') || pnome;
  const ddd = d.whatsapp.slice(0, 2), fone = d.whatsapp.slice(2);
  const itens = [{ id: 'corrida-2026', title: TITULO, description: DESCRICAO, category_id: 'services', quantity: 1, unit_price: VALOR_CARTAO, currency_id: 'BRL' }];
  const r = await mp('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: itens,
      payer: { name: pnome, surname: sobrenome, email: d.email, phone: { area_code: ddd, number: fone }, ...identificacao(d) },
      additional_info: { items: itens, payer: { first_name: pnome, last_name: sobrenome, phone: { area_code: ddd, number: fone } } },
      statement_descriptor: 'DZIMBA CORRIDA',
      external_reference: id,
      notification_url: `${PUBLIC_BASE}/api/webhook`,
      payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }], installments: MAX_PARCELAS, default_installments: 1 },
      back_urls: { success: `${PUBLIC_BASE}/obrigado/`, pending: `${PUBLIC_BASE}/obrigado/`, failure: `${PUBLIC_BASE}/?pagamento=falhou` },
      auto_return: 'approved',
    }),
  });
  if (!r.ok) { console.error('MP pref erro', r.status, r.body); return res.status(502).json({ error: 'falha_cartao' }); }
  db[id] = { id, ...d, valor: VALOR_CARTAO, lote: LOTE, metodo: 'cartao', mp_id: null, status: 'pending', criado: new Date().toISOString(), pago: null };
  save();
  res.json({ id, init_point: r.body.init_point });
});

// cartão recusado: a pessoa volta para o site e já recebe o PIX do mesmo lote (sem a taxa do cartão)
app.post('/api/pix-do-cartao', async (req, res) => {
  if (!TOKEN) return res.status(503).json({ error: 'pagamento_nao_configurado' });
  const rec = db[String(req.body.id || '')];
  if (!rec || rec.manual) return res.status(404).json({ error: 'nao_encontrado' });
  if (rec.status === 'approved') return res.json({ id: rec.id, status: 'approved', grupo: cfg.grupoLink || '' });
  const pid = digits(req.body.payment_id);
  if (pid) {
    const p = await mp('/v1/payments/' + pid);
    if (p.ok && p.body.external_reference === rec.id) {
      if (p.body.status === 'approved') { rec.mp_id = pid; aprovar(rec); return res.json({ id: rec.id, status: 'approved', grupo: cfg.grupoLink || '' }); }
      if (p.body.status === 'rejected') registrarRecusa(rec, p.body);
    }
  }
  if (rec.metodo === 'pix' && rec.pixQr && rec.status === 'pending') return res.json({ id: rec.id, ...rec.pixQr });
  if (esgotado()) return res.status(409).json({ error: 'esgotado', detalhe: 'As vagas acabaram.' });
  const VALOR = (LOTES.find(l => l.numero === rec.lote) || {}).valor || valorAtual();
  const [primeiro, ...resto] = rec.nome.split(' ');
  const r = await mp('/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': rec.id + '-pix' },
    body: JSON.stringify({
      transaction_amount: VALOR,
      description: TITULO,
      payment_method_id: 'pix',
      notification_url: `${PUBLIC_BASE}/api/webhook`,
      external_reference: rec.id,
      payer: { email: rec.email, first_name: primeiro, last_name: resto.join(' '), ...identificacao(rec) },
    }),
  });
  if (!r.ok) { console.error('MP pix (cartão recusado) erro', r.status, r.body); return res.status(502).json({ error: 'falha_pix' }); }
  const tx = r.body.point_of_interaction?.transaction_data || {};
  rec.metodo = 'pix'; rec.valor = VALOR; rec.mp_id = r.body.id; rec.status = 'pending';
  rec.pixQr = { qr_code: tx.qr_code, qr_code_base64: tx.qr_code_base64, expira: tx.expiration_date };
  save();
  res.json({ id: rec.id, ...rec.pixQr });
});

// o front pergunta o status enquanto o PIX não confirma
app.get('/api/status/:id', async (req, res) => {
  const rec = db[req.params.id];
  if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  if (rec.status !== 'approved' && rec.mp_id && TOKEN) {
    const r = await mp('/v1/payments/' + rec.mp_id);
    if (r.ok && r.body.status === 'approved') aprovar(rec);
  }
  res.json({ status: rec.status, grupo: rec.status === 'approved' ? (cfg.grupoLink || '') : undefined });
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
    if (!rec) return;
    if (r.body.status === 'rejected') { registrarRecusa(rec, r.body); return; }
    rec.mp_id = paymentId;
    if (r.body.status === 'approved') aprovar(rec);
    else if (rec.status === 'pending') { rec.status = r.body.status; save(); }
  } catch (e) { console.error('webhook', e); }
});

// motivo da recusa em português (status_detail do Mercado Pago)
const MOTIVOS = {
  cc_rejected_high_risk: 'Antifraude do Mercado Pago',
  cc_rejected_blacklist: 'Cartão bloqueado pelo Mercado Pago',
  cc_rejected_insufficient_amount: 'Sem limite/saldo',
  cc_rejected_bad_filled_security_code: 'Código de segurança errado',
  cc_rejected_bad_filled_date: 'Validade errada',
  cc_rejected_bad_filled_card_number: 'Número do cartão errado',
  cc_rejected_bad_filled_other: 'Dados do cartão errados',
  cc_rejected_call_for_authorize: 'Banco pediu autorização do titular',
  cc_rejected_card_disabled: 'Cartão desativado no banco',
  cc_rejected_card_type_not_allowed: 'Tipo de cartão não aceito',
  cc_rejected_duplicated_payment: 'Pagamento repetido',
  cc_rejected_max_attempts: 'Tentativas demais',
  cc_rejected_invalid_installments: 'Parcelamento não aceito',
  cc_rejected_other_reason: 'Recusado pelo banco do cartão',
  rejected_by_bank: 'Recusado pelo banco do cartão',
  rejected_by_regulations: 'Recusado por regra do Mercado Pago',
  rejected_high_risk: 'Antifraude do Mercado Pago',
};
function registrarRecusa(rec, pg) {
  rec.recusas = rec.recusas || [];
  if (rec.recusas.some(x => String(x.mp_id) === String(pg.id))) return;
  rec.recusas.push({ mp_id: pg.id, em: new Date().toISOString(), detalhe: pg.status_detail || '', motivo: MOTIVOS[pg.status_detail] || pg.status_detail || 'Recusado', bandeira: pg.payment_method_id || '' });
  if (rec.status === 'pending') rec.status = 'rejected';
  save();
}

function aprovar(rec) {
  if (rec.status === 'approved') return;
  rec.status = 'approved'; rec.pago = new Date().toISOString();
  limparPendentes(rec);
  if (!rec.posFeito) rec.posAgendadoPara = Date.now() + ESPERA_MS;
  save();
}

// ── WhatsApp da academia (Evolution Go) ───────────────────────────────────
// A instância é identificada pelo TOKEN dela no header apikey; a chave global só serve p/ criar a instância.
const EVO_URL = process.env.EVOLUTION_URL || 'http://127.0.0.1:8081';
const EVO_TOKEN = process.env.EVOLUTION_TOKEN || '';
const EVO_GLOBAL = process.env.EVOLUTION_GLOBAL_KEY || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'dzimba-corrida';
const temZap = () => !!EVO_TOKEN;

const evo = (p, { method = 'GET', body, global = false, timeout = 10000 } = {}) => fetch(EVO_URL + p, {
  method, headers: { apikey: global ? EVO_GLOBAL : EVO_TOKEN, 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout),
}).then(async r => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }));

const chaveFone = s => { let d = digits(s); if (d.length >= 12 && d.startsWith('55')) d = d.slice(2); return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d; };
const numeroZap = rec => { let d = digits(rec.whatsapp); if (d.length >= 12 && d.startsWith('55')) d = d.slice(2); return '55' + d; };
const primeiroNome = rec => String(rec.nome || '').split(' ')[0] || '';
const dormir = ms => new Promise(r => setTimeout(r, ms));
const erroEvo = r => 'falhou:' + String((r.body && (r.body.error || r.body.message)) || r.status).slice(0, 160);

function limparPendentes(rec) {
  const chave = chaveFone(rec.whatsapp), mail = String(rec.email || '').toLowerCase();
  for (const [id, r] of Object.entries(db)) {
    if (id === rec.id || r.status !== 'pending') continue;
    if ((chave && chaveFone(r.whatsapp) === chave) || (mail && String(r.email || '').toLowerCase() === mail)) delete db[id];
  }
}

async function estadoZap() {
  if (!temZap()) return 'nao_configurado';
  try {
    const r = await evo('/instance/status');
    const d = r.body && r.body.data;
    if (!d) return 'desconhecido';
    return d.LoggedIn && d.Connected ? 'open' : d.Connected ? 'aguardando_qr' : 'desconectado';
  } catch { return 'erro'; }
}

// membros do grupo escolhido (números) — cache de 1 min
let grupoCache = { at: 0, data: null };
async function grupoInfo(forcar) {
  if (!temZap() || !cfg.grupoJid) return null;
  if (!forcar && grupoCache.data && Date.now() - grupoCache.at < 60000) return grupoCache.data;
  try {
    const r = await evo('/group/info', { method: 'POST', body: { groupJid: cfg.grupoJid } });
    if (!r.ok) return grupoCache.data;
    const txt = JSON.stringify(r.body);
    const nums = [...new Set([...txt.matchAll(/(\d{10,15})@s\.whatsapp\.net/g)].map(m => chaveFone(m[1])))];
    const d = r.body.data || {};
    const nome = d.Name || d.GroupName?.Name || d.Subject || cfg.grupoNome || 'Grupo do curso';
    const data = { nome, total: (d.Participants || []).length || nums.length, membros: nums };
    grupoCache = { at: Date.now(), data };
    return data;
  } catch (e) { console.error('grupo', e.message); return grupoCache.data; }
}

async function adicionarNoGrupo(rec) {
  if (!temZap()) return 'whatsapp_nao_configurado';
  if (!cfg.grupoJid) return 'sem_grupo';
  const r = await evo('/group/participant', { method: 'POST', body: { groupJid: cfg.grupoJid, action: 'add', participants: [numeroZap(rec)] } });
  grupoCache = { at: 0, data: null };
  const txt = JSON.stringify(r.body || {});
  if (r.ok && !/"error"/.test(txt) && !/\b40[389]\b/.test(txt)) return 'adicionado';
  if (/\b409\b/.test(txt)) return 'ja_no_grupo';
  if (/\b403\b/.test(txt)) return 'privacidade';
  if (/\b408\b/.test(txt)) return 'saiu_recente';
  return erroEvo(r);
}

const NIVEL_TXT = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };
const corpoConfirmacao = rec =>
  `Oi, ${primeiroNome(rec)}! Sua inscrição no *Curso Treinamento de Corrida de Rua* está confirmada. 🏃\n\n` +
  `📅 Sábado, 12/12/2026\n` +
  `🎫 Credenciamento: 7h30 às 11h na Academia D'Zimba (Av. Renato Ramos da Silva, 3724, Vila Nova)\n` +
  `🎤 Curso: 14h30 no Auditório do Praia Hotel, Imbituba\n` +
  `👤 Palestrante: Marcos Paulo Huber\n\n`;
const textoConvite = rec => corpoConfirmacao(rec) +
  (cfg.grupoLink ? `Entre no *grupo dos inscritos* pelo link abaixo. É por lá que vão todos os avisos do curso:\n${cfg.grupoLink}`
                 : `Em breve você recebe o link do grupo dos inscritos.`);
const textoNoGrupo = (rec, adicionado) => corpoConfirmacao(rec) +
  (adicionado ? `Já te adicionamos ao *grupo dos inscritos*.` : `Você já está no *grupo dos inscritos*.`) +
  ` É por lá que vão todos os avisos do curso. O certificado chega aqui no seu WhatsApp depois do curso.`;

async function enviarTexto(rec, texto) {
  if (!temZap()) return 'whatsapp_nao_configurado';
  const r = await evo('/send/text', { method: 'POST', body: { number: numeroZap(rec), text: texto || textoConvite(rec), delay: 1500 }, timeout: 30000 });
  return r.ok && !(r.body && r.body.error) ? 'enviado' : erroEvo(r);
}

// ── pós-pagamento (espera alguns minutos para a pessoa entrar pelo link sozinha) ──
const ESPERA_MS = (Number(process.env.ESPERA_GRUPO_MIN) || 5) * 60000;
async function processarPos(rec) {
  rec.pos = rec.pos || {};
  const g = await grupoInfo(true).catch(() => null);
  const jaNoGrupo = g && g.membros.length ? g.membros.includes(chaveFone(rec.whatsapp)) : false;
  let texto;
  if (jaNoGrupo) { rec.pos.grupo = 'ja_no_grupo'; texto = textoNoGrupo(rec, false); }
  else {
    let add; try { add = await adicionarNoGrupo(rec); } catch (e) { add = 'falhou:' + e.message; }
    rec.pos.grupo = add;
    texto = (add === 'adicionado' || add === 'ja_no_grupo') ? textoNoGrupo(rec, true) : textoConvite(rec);
  }
  save();
  await dormir(2500);
  try { rec.pos.texto = await enviarTexto(rec, texto); } catch (e) { rec.pos.texto = 'falhou:' + e.message; }
  rec.pos.em = new Date().toISOString();
  rec.posFeito = true; rec.posAgendadoPara = null;
  save();
  console.log(`[pos] ${rec.nome}: grupo=${rec.pos.grupo} texto=${rec.pos.texto}`);
}

// ── certificado em PDF ──────────────────────────────────────────────────────
// Arte: assets/certificado-fundo.jpg, gerada de assets/certificado.html (1123×794 px CSS, Chrome headless ×2,5).
// O nome e o código são escritos aqui; as posições abaixo saem do data-pos que o próprio HTML calcula.
const assinatura = id => crypto.createHmac('sha256', SEGREDO).update(String(id)).digest('hex').slice(0, 20);
const urlCertificado = rec => `${PUBLIC_BASE}/api/certificado/${rec.id}.pdf?t=${assinatura(rec.id)}`;
// código de verificação impresso no certificado (XXXX-XXXX), conferido em /corrida/validar/
const codigoCert = id => crypto.createHmac('sha256', SEGREDO).update('cert:' + id).digest('hex').slice(0, 8).toUpperCase().replace(/^(.{4})/, '$1-');
const CERT_POS = { larg: 1123, nomeCx: 711.5, nomeBase: 288, nomeLarg: 600, codDir: 1023, codMeio: 720.75 };
let fontes = null;
async function gerarCertificado(nome, codigo) {
  if (!fontes) fontes = {
    fundo: fs.readFileSync(path.join(ASSETS, 'certificado-fundo.jpg')),
    nome: fs.readFileSync(path.join(ASSETS, 'CormorantGaramond-SemiBoldItalic.ttf')),
    cod: fs.readFileSync(path.join(ASSETS, 'Barlow-Medium.ttf')),
  };
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('Certificado - ' + nome); pdf.setAuthor("Academia D'Zimba");
  const img = await pdf.embedJpg(fontes.fundo);
  const W = 842, H = W * img.height / img.width, s = W / CERT_POS.larg;   // A4 deitado
  const page = pdf.addPage([W, H]);
  page.drawImage(img, { x: 0, y: 0, width: W, height: H });
  const fNome = await pdf.embedFont(fontes.nome);   // sem subset: o subset do pdf-lib perde glifos do Cormorant
  let tam = 40;
  while (tam > 16 && fNome.widthOfTextAtSize(nome, tam) > (CERT_POS.nomeLarg - 30) * s) tam -= 0.5;
  page.drawText(nome, { x: CERT_POS.nomeCx * s - fNome.widthOfTextAtSize(nome, tam) / 2, y: H - CERT_POS.nomeBase * s, size: tam, font: fNome, color: rgb(0.08, 0.094, 0.067) });
  if (codigo) {
    const fCod = await pdf.embedFont(fontes.cod, { subset: true });
    const txt = 'CÓDIGO DE VERIFICAÇÃO  ' + codigo, tc = 7.6;
    page.drawText(txt, { x: CERT_POS.codDir * s - fCod.widthOfTextAtSize(txt, tc), y: H - CERT_POS.codMeio * s - tc * 0.35, size: tc, font: fCod, color: rgb(0.365, 0.392, 0.333) });
  }
  return Buffer.from(await pdf.save());
}
const nomeArquivo = rec => 'Certificado Corrida de Rua - ' + String(rec.nome).replace(/[^\p{L}\p{N} ]/gu, '').trim() + '.pdf';

// PDF público (link assinado) — é por esse link que a Evolution baixa o arquivo pra enviar
app.get('/api/certificado/:id.pdf', async (req, res) => {
  const rec = db[req.params.id];
  const okAdmin = ADMIN_KEY && req.query.key === ADMIN_KEY;
  if (!rec || rec.status !== 'approved' || (!okAdmin && req.query.t !== assinatura(rec.id))) return res.status(404).send('não encontrado');
  try {
    const buf = await gerarCertificado(rec.nome, codigoCert(rec.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.baixar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(nomeArquivo(rec))}`);
    res.send(buf);
  } catch (e) { console.error('certificado', e); res.status(500).send('erro ao gerar'); }
});
// validação pública do código impresso no certificado
app.get('/api/validar/:codigo', (req, res) => {
  const cod = String(req.params.codigo || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (cod.length !== 8) return res.json({ ok: false });
  const rec = Object.values(db).find(r => r && r.status === 'approved' && (r.presente || (r.cert && r.cert.status === 'enviado')) && codigoCert(r.id).replace('-', '') === cod);
  if (!rec) return res.json({ ok: false });
  res.json({ ok: true, nome: rec.nome, curso: 'Treinamento de Corrida de Rua: do iniciante ao avançado', data: '12/12/2026', carga: '5 horas' });
});
// prévia com um nome qualquer (só no painel)
app.get('/api/certificado-previa', async (req, res) => {
  if (!admin(req, res)) return;
  try {
    const buf = await gerarCertificado(String(req.query.nome || 'Nome do Participante').slice(0, 80), 'A1B2-C3D4');
    res.setHeader('Content-Type', 'application/pdf'); res.send(buf);
  } catch (e) { console.error('previa', e); res.status(500).send('erro ao gerar'); }
});

async function enviarCertificado(rec) {
  if (!temZap()) return 'whatsapp_nao_configurado';
  const r = await evo('/send/media', {
    method: 'POST', timeout: 60000,
    body: {
      number: numeroZap(rec), type: 'document', url: urlCertificado(rec), filename: nomeArquivo(rec),
      caption: `${primeiroNome(rec)}, obrigado por participar do *Curso Treinamento de Corrida de Rua*! 🏃\nAqui está o seu certificado (5 horas). Bons treinos!

Código de verificação: ${codigoCert(rec.id)} (confira em ${PUBLIC_BASE}/validar/)`,
      delay: 1500,
    },
  });
  return r.ok && !(r.body && r.body.error) ? 'enviado' : erroEvo(r);
}

// ── worker: pós-pagamento e certificados (um por vez, com intervalo) ──────────
let rodando = false;
async function tick() {
  if (rodando || !temZap()) return;
  rodando = true;
  try {
    if ((await estadoZap()) !== 'open') return;
    const agora = Date.now();
    for (const rec of Object.values(db).filter(r => r.status === 'approved' && !r.posFeito && r.posAgendadoPara && r.posAgendadoPara <= agora)) {
      try { await processarPos(rec); } catch (e) { console.error('pos', rec.nome, e.message); }
      await dormir(5000);
    }
    // certificados: fila manual (painel) ou automático a partir de CERT_AUTO_EM para quem fez o credenciamento
    const auto = Date.parse(CERT_AUTO_EM) <= agora;
    const fila = Object.values(db).filter(r => r.status === 'approved' && !r.oculto && !(r.cert && r.cert.status === 'enviado') && (r.certFila || (auto && r.presente)));
    for (const rec of fila.slice(0, 6)) {     // no máximo 6 por minuto, com 6–10 s entre um e outro
      try { const st = await enviarCertificado(rec); rec.cert = { status: st, em: new Date().toISOString() }; }
      catch (e) { rec.cert = { status: 'falhou:' + e.message, em: new Date().toISOString() }; }
      if (rec.cert.status === 'enviado' || (rec.cert.tentativas = (rec.cert.tentativas || 0) + 1) >= 3) rec.certFila = false;
      save();
      await dormir(6000 + Math.random() * 4000);
    }
  } finally { rodando = false; }
}
if (temZap()) { setInterval(tick, 60000); setTimeout(tick, 8000); }

// ── painel ─────────────────────────────────────────────────────────────────
app.get('/api/painel', async (req, res) => {
  if (!admin(req, res)) return;
  const g = await grupoInfo(req.query.atualizar === '1');
  const membros = new Set(g?.membros || []);
  let n = 0;
  const todos = Object.values(db);
  const list = todos.filter(r => !r.oculto).sort((a, b) => (a.criado || '').localeCompare(b.criado || ''))
    .map(r => ({ ...r, ordem: r.status === 'approved' ? ++n : null, noGrupo: membros.size ? membros.has(chaveFone(r.whatsapp)) : null,
      certUrl: r.status === 'approved' ? urlCertificado(r) : null }));
  const ps = list.filter(r => r.status === 'approved');
  res.json({
    evento: { valor: valorAtual(), lote: loteAtual(), lotes: LOTES, vendidos: vendidos(), vagas: VAGAS || null, certAutoEm: CERT_AUTO_EM, pagamento: !!TOKEN },
    grupo: cfg.grupoJid ? { nome: g?.nome || cfg.grupoNome, total: g?.total ?? null, link: cfg.grupoLink || '' } : null,
    whatsapp: { estado: await estadoZap(), instancia: EVO_INSTANCE },
    resumo: {
      total: list.length, pagos: ps.length, pendentes: list.filter(r => r.status === 'pending').length,
      arrecadado: todos.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.valor || 0), 0),
      noGrupo: ps.filter(r => r.noGrupo === true).length, foraGrupo: ps.filter(r => r.noGrupo === false).length,
      presentes: ps.filter(r => r.presente).length, patrocinadores: ps.filter(r => r.patrocinadores).length, certificados: ps.filter(r => r.cert && r.cert.status === 'enviado').length,
    },
    inscritos: list,
  });
});

app.post('/api/manual', (req, res) => {
  if (!admin(req, res)) return;
  const nome = String(req.body.nome || '').trim();
  const whatsapp = digits(req.body.whatsapp);
  if (!ok(nome) || whatsapp.length < 10) return res.status(400).json({ error: 'dados_invalidos' });
  const metodo = ['dinheiro', 'pix', 'cartao', 'transferencia', 'cortesia'].includes(req.body.metodo) ? req.body.metodo : 'dinheiro';
  const id = crypto.randomUUID();
  const rec = { id, nome, email: String(req.body.email || '').trim(), whatsapp, nivel: NIVEIS.includes(req.body.nivel) ? req.body.nivel : '',
    patrocinadores: req.body.patrocinadores === true, ...(req.body.patrocinadores === true ? { patrocinadoresEm: new Date().toISOString() } : {}),
    lote: metodo === 'cortesia' ? null : (loteAtual()?.numero || null),
    valor: metodo === 'cortesia' ? 0 : (Number(req.body.valor) || valorAtual()), metodo, mp_id: null, status: 'pending', criado: new Date().toISOString(), pago: null, manual: true };
  db[id] = rec;
  aprovar(rec);
  res.json({ ok: true, inscrito: rec });
});

app.patch('/api/inscrito/:id', (req, res) => {
  if (!admin(req, res)) return;
  const rec = db[req.params.id];
  if (!rec) return res.status(404).json({ error: 'nao_encontrado' });
  if (req.body.whatsapp !== undefined) { const w = digits(req.body.whatsapp); if (w.length < 10) return res.status(400).json({ error: 'telefone_invalido' }); rec.whatsapp = w; }
  if (ok(req.body.nome)) rec.nome = String(req.body.nome).trim().replace(/\s+/g, ' ');
  if (req.body.email && /.+@.+\..+/.test(req.body.email)) rec.email = String(req.body.email).trim();
  if (typeof req.body.presente === 'boolean') { rec.presente = req.body.presente; rec.presenteEm = req.body.presente ? new Date().toISOString() : null; }
  if (typeof req.body.oculto === 'boolean') rec.oculto = req.body.oculto;
  if (typeof req.body.patrocinadores === 'boolean' && req.body.patrocinadores !== !!rec.patrocinadores) { rec.patrocinadores = req.body.patrocinadores; rec.patrocinadoresEm = req.body.patrocinadores ? new Date().toISOString() : null; }
  save();
  res.json({ ok: true, inscrito: rec });
});

// ações manuais por inscrito
const porId = (req, res) => { const rec = db[req.body.id]; if (!rec) { res.status(404).json({ error: 'nao_encontrado' }); return null; } return rec; };
app.post('/api/grupo/adicionar', async (req, res) => {
  if (!admin(req, res)) return; const rec = porId(req, res); if (!rec) return;
  const r = await adicionarNoGrupo(rec).catch(e => 'falhou:' + e.message); rec.pos = { ...(rec.pos || {}), grupo: r }; save();
  res.json({ ok: r === 'adicionado' || r === 'ja_no_grupo', resultado: r });
});
app.post('/api/convite', async (req, res) => {
  if (!admin(req, res)) return; const rec = porId(req, res); if (!rec) return;
  const r = await enviarTexto(rec).catch(e => 'falhou:' + e.message); rec.pos = { ...(rec.pos || {}), texto: r }; save();
  res.json({ ok: r === 'enviado', detalhe: r });
});
app.post('/api/certificado/enviar', async (req, res) => {
  if (!admin(req, res)) return; const rec = porId(req, res); if (!rec) return;
  if (rec.status !== 'approved') return res.status(400).json({ error: 'nao_pago' });
  const r = await enviarCertificado(rec).catch(e => 'falhou:' + e.message); rec.cert = { status: r, em: new Date().toISOString() }; rec.certFila = false; save();
  res.json({ ok: r === 'enviado', detalhe: r });
});
// coloca na fila de certificados: "presentes" (padrão) ou "todos" os pagos
app.post('/api/certificados/fila', (req, res) => {
  if (!admin(req, res)) return;
  const todos = req.body.alvo === 'todos';
  let n = 0;
  for (const r of pagos()) if ((todos || r.presente) && !(r.cert && r.cert.status === 'enviado')) { r.certFila = true; n++; }
  save();
  res.json({ ok: true, naFila: n });
});

// ── WhatsApp: estado, QR para parear e grupo ──────────────────────────────────
async function garantirInstancia() {
  if (!EVO_GLOBAL) return;
  const r = await evo('/instance/all', { global: true });
  const existe = (r.body?.data || []).some(i => i.name === EVO_INSTANCE);
  if (!existe) await evo('/instance/create', { method: 'POST', global: true, body: { name: EVO_INSTANCE, token: EVO_TOKEN } });
}
app.get('/api/whatsapp/qr', async (req, res) => {
  if (!admin(req, res)) return;
  if (!temZap()) return res.status(503).json({ error: 'nao_configurado' });
  try {
    if ((await estadoZap()) === 'open') return res.json({ estado: 'open' });
    let q = await evo('/instance/qr');
    if (!q.body?.data?.qrcode) {
      await garantirInstancia().catch(() => {});
      await evo('/instance/connect', { method: 'POST', body: {} });
      await dormir(3500);
      q = await evo('/instance/qr');
    }
    res.json({ estado: 'aguardando', qr: q.body?.data?.qrcode || null, detalhe: q.body?.error });
  } catch (e) { res.status(502).json({ error: 'falha', detalhe: e.message }); }
});
app.get('/api/whatsapp/grupos', async (req, res) => {
  if (!admin(req, res)) return;
  // /group/list = todos os grupos em que o número está (o /group/myall só traz os que ele criou)
  const r = await evo('/group/list', { timeout: 30000 }).catch(e => ({ ok: false, body: { error: e.message } }));
  if (!r.ok) return res.status(502).json({ error: 'falha', detalhe: r.body?.error });
  const lista = (r.body.data || []).map(g => ({ jid: g.JID || g.jid, nome: g.Name || g.GroupName?.Name || g.Subject || g.name || '(sem nome)',
    membros: (g.Participants || g.participants || []).length })).filter(g => g.jid);
  res.json({ grupos: lista, atual: cfg.grupoJid || null });
});
app.post('/api/whatsapp/grupo', async (req, res) => {
  if (!admin(req, res)) return;
  const jid = String(req.body.jid || '');
  if (!/@g\.us$/.test(jid)) return res.status(400).json({ error: 'grupo_invalido' });
  let link = '';
  try {
    const r = await evo('/group/invitelink', { method: 'POST', body: { groupJid: jid } });
    const d = r.body?.data; link = typeof d === 'string' ? d : (d?.link || d?.inviteLink || '');
    if (link && !/^https?:/.test(link)) link = 'https://chat.whatsapp.com/' + link;
  } catch {}
  Object.assign(cfg, { grupoJid: jid, grupoNome: String(req.body.nome || ''), grupoLink: link || cfg.grupoLink || '' });
  await saveCfg(); grupoCache = { at: 0, data: null };
  res.json({ ok: true, link: cfg.grupoLink });
});
app.post('/api/whatsapp/grupo-link', async (req, res) => {   // se o link automático não vier, cola à mão
  if (!admin(req, res)) return;
  const link = String(req.body.link || '').trim();
  if (link && !/^https:\/\/chat\.whatsapp\.com\/\w+/.test(link)) return res.status(400).json({ error: 'link_invalido' });
  cfg.grupoLink = link; await saveCfg(); res.json({ ok: true });
});

// planilha CSV
app.get('/api/admin', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).send('nao autorizado');
  const list = Object.values(db).filter(r => !r.oculto).sort((a, b) => (a.criado || '').localeCompare(b.criado || ''));
  if (!req.query.csv) return res.redirect(PUBLIC_BASE + '/painel/');
  // só pagos que marcaram a autorização: é esta planilha que vai para os patrocinadores
  if (req.query.csv === 'patrocinadores') {
    const rs = [['nome', 'whatsapp', 'email', 'nivel', 'autorizou em'],
      ...list.filter(r => r.status === 'approved' && r.patrocinadores).map(r => [r.nome, r.whatsapp, r.email, NIVEL_TXT[r.nivel] || '', r.patrocinadoresEm ? new Date(r.patrocinadoresEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''])];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=contatos-patrocinadores-corrida-dzimba.csv');
    return res.send('\ufeff' + rs.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(';')).join('\n'));
  }
  let nc = 0;
  const rows = [['#', 'nome', 'whatsapp', 'cpf', 'email', 'nivel', 'status', 'metodo', 'valor', 'inscrito', 'pago', 'grupo', 'mensagem', 'presente', 'certificado', 'patrocinadores', 'cartao recusado'],
    ...list.map(r => [r.status === 'approved' ? ++nc : '', r.nome, r.whatsapp, r.cpf || '', r.email, NIVEL_TXT[r.nivel] || '', r.status, r.metodo, r.valor, r.criado, r.pago || '',
      r.pos?.grupo || '', r.pos?.texto || '', r.presente ? 'sim' : '', r.cert?.status || '', r.patrocinadores ? 'autorizou' : '', (r.recusas || []).map(x => x.motivo).join(' | ')])];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=inscritos-corrida-dzimba.csv');
  res.send('﻿' + rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(';')).join('\n'));
});

app.listen(PORT, '127.0.0.1', () => console.log(`corrida d'zimba :${PORT} · pagamento ${TOKEN ? 'ATIVO' : 'não configurado'} · whatsapp ${temZap() ? EVO_INSTANCE : 'não configurado'}`));
