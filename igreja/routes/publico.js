const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const router = express.Router();

// Anti-spam no cadastro público (sem login)
const publicoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitos cadastros a partir deste acesso. Tente mais tarde.' },
});

// Cadastro publico de membro (sem login) — usado pelo formulario que a pessoa preenche.
// Hoje a igreja e unica (id da primeira). Quando virar multi-igreja, recebe um token/slug.
router.post('/cadastro-membro', publicoLimiter, async (req, res) => {
  const { nome, telefone, endereco, data_nascimento, sexo, slug, consentimento } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  if (!slug) return res.status(400).json({ erro: 'Link de cadastro inválido (igreja não identificada).' });
  if (!consentimento) return res.status(400).json({ erro: 'É necessário aceitar a Política de Privacidade.' });

  try {
    // Multi-tenant: a igreja é identificada pelo slug do link, nunca "a primeira".
    const { rows: igr } = await db.query('SELECT id FROM igrejas WHERE slug = $1', [slug]);
    if (!igr.length) return res.status(404).json({ erro: 'Igreja não encontrada para este link.' });
    const igreja_id = igr[0].id;

    // Trava: não permite mesmo nome + mesmo telefone
    const dup = await db.query(
      `SELECT 1 FROM membros WHERE igreja_id=$1
         AND lower(btrim(nome)) = lower(btrim($2))
         AND regexp_replace(coalesce(telefone,''),'\\D','','g') = regexp_replace($3,'\\D','','g')
       LIMIT 1`,
      [igreja_id, nome, telefone || '']
    );
    if (dup.rows.length) return res.status(409).json({ erro: 'Você já está cadastrado (mesmo nome e telefone).' });

    await db.query(
      `INSERT INTO membros (igreja_id, nome, telefone, endereco, data_nascimento, sexo, origem, consentimento_em)
       VALUES ($1,$2,$3,$4,$5,$6,'publico', NOW())`,
      [igreja_id, nome.trim(), telefone || '', endereco || '', data_nascimento || null, sexo || null]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao cadastrar' });
  }
});

// ══════════════════════════════════════════════
//  DISPONIBILIDADE (link público por membro) — Fase 3
//  A pessoa marca as DATAS em que PODE servir. Sem login; identificada pelo token.
// ══════════════════════════════════════════════
const dispLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitos acessos. Tente mais tarde.' },
});

const hojeISO = () => new Date().toISOString().slice(0, 10);
const addDias = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };

// Expande cultos/eventos num intervalo [ini, fim] em ocorrências por data (dedup por data+titulo)
async function ocorrenciasNoIntervalo(igreja_id, ini, fim) {
  const conc = await db.query(
    `SELECT to_char(data,'YYYY-MM-DD') AS data, titulo, hora, tipo
       FROM eventos WHERE igreja_id=$1 AND data BETWEEN $2 AND $3`, [igreja_id, ini, fim]
  );
  const fixos = await db.query('SELECT titulo, dia_semana, hora FROM cultos_fixos WHERE igreja_id=$1 AND ativo=TRUE', [igreja_id]);
  const vistos = new Set(), out = [];
  const push = (o) => { const k = o.data + '|' + o.titulo; if (vistos.has(k)) return; vistos.add(k); out.push(o); };
  conc.rows.forEach((r) => push({ data: r.data, titulo: r.titulo, hora: r.hora || '', tipo: r.tipo }));
  for (let d = ini; d <= fim; d = addDias(d, 1)) {
    const [a, m, dd] = d.split('-').map(Number);
    const wd = new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
    fixos.rows.forEach((f) => { if (f.dia_semana === wd) push({ data: d, titulo: f.titulo, hora: f.hora || '', tipo: 'culto_fixo' }); });
  }
  return out.sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora));
}

router.get('/disponibilidade/:token', dispLimiter, async (req, res) => {
  const t = req.params.token;
  const { rows } = await db.query(
    'SELECT id, igreja_id, nome FROM membros WHERE escala_token=$1', [t]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Link inválido' });
  const me = rows[0];
  const ini = hojeISO(), fim = addDias(ini, 90);
  const ocorrencias = await ocorrenciasNoIntervalo(me.igreja_id, ini, fim);
  const marc = await db.query(
    `SELECT to_char(data,'YYYY-MM-DD') AS data FROM disponibilidades WHERE membro_id=$1 AND data>=$2`, [me.id, ini]
  );
  const igr = await db.query('SELECT nome FROM igrejas WHERE id=$1', [me.igreja_id]);
  res.json({
    membro: me.nome, igreja: igr.rows[0] ? igr.rows[0].nome : '',
    ocorrencias, marcadas: marc.rows.map((r) => r.data),
  });
});

router.post('/disponibilidade/:token', dispLimiter, async (req, res) => {
  const t = req.params.token;
  const { rows } = await db.query('SELECT id, igreja_id FROM membros WHERE escala_token=$1', [t]);
  if (!rows.length) return res.status(404).json({ erro: 'Link inválido' });
  const me = rows[0];
  const ini = hojeISO();
  const datas = (Array.isArray(req.body.datas) ? req.body.datas : [])
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= ini);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // substitui só a partir de hoje (mantém histórico passado)
    await client.query('DELETE FROM disponibilidades WHERE membro_id=$1 AND data>=$2', [me.id, ini]);
    for (const d of [...new Set(datas)]) {
      await client.query('INSERT INTO disponibilidades (igreja_id, membro_id, data) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [me.igreja_id, me.id, d]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, total: datas.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e); res.status(500).json({ erro: 'Erro ao salvar' });
  } finally { client.release(); }
});

module.exports = router;
