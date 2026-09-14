const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();

const ig = (req) => req.session.usuario.igreja_id;

// soma dias a uma data 'YYYY-MM-DD' sem cair na armadilha de fuso
const addDias = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};

// ══════════════════════════════════════════════
//  MINISTÉRIOS
// ══════════════════════════════════════════════

// Lista ministérios com a contagem de membros
router.get('/ministerios', async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.*, (SELECT COUNT(*) FROM ministerio_membros mm WHERE mm.ministerio_id = m.id) AS qtd_membros
     FROM ministerios m WHERE m.igreja_id=$1 ORDER BY m.nome`,
    [ig(req)]
  );
  res.json(rows);
});

// Detalhe de um ministério + os membros que fazem parte
router.get('/ministerios/:id', async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM ministerios WHERE id=$1 AND igreja_id=$2', [req.params.id, ig(req)]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Ministério não encontrado' });
  const membros = await db.query(
    `SELECT me.id, me.nome, me.telefone,
            COALESCE(array_agg(mf.funcao_id) FILTER (WHERE mf.funcao_id IS NOT NULL
              AND mf.funcao_id IN (SELECT id FROM funcoes WHERE ministerio_id=$1)), '{}') AS funcoes
     FROM ministerio_membros mm
     JOIN membros me ON me.id = mm.membro_id
     LEFT JOIN membro_funcoes mf ON mf.membro_id = me.id
     WHERE mm.ministerio_id=$1 GROUP BY me.id ORDER BY me.nome`, [req.params.id]
  );
  const funcoes = await db.query('SELECT * FROM funcoes WHERE ministerio_id=$1 AND ativo=TRUE ORDER BY nome', [req.params.id]);
  res.json({ ...rows[0], membros: membros.rows, funcoes: funcoes.rows });
});

// ── Funções (cargos) de um ministério ──
router.post('/ministerios/:id/funcoes', async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome da função' });
  const dono = await db.query('SELECT 1 FROM ministerios WHERE id=$1 AND igreja_id=$2', [req.params.id, ig(req)]);
  if (!dono.rows.length) return res.status(404).json({ erro: 'Ministério não encontrado' });
  const { rows } = await db.query(
    'INSERT INTO funcoes (igreja_id, ministerio_id, nome) VALUES ($1,$2,$3) RETURNING *',
    [ig(req), req.params.id, nome.trim()]
  );
  res.status(201).json(rows[0]);
});

router.put('/funcoes/:id', async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome' });
  await db.query('UPDATE funcoes SET nome=$1 WHERE id=$2 AND igreja_id=$3', [nome.trim(), req.params.id, ig(req)]);
  res.json({ ok: true });
});

router.delete('/funcoes/:id', async (req, res) => {
  await db.query('DELETE FROM funcoes WHERE id=$1 AND igreja_id=$2', [req.params.id, ig(req)]);
  res.json({ ok: true });
});

router.post('/ministerios', async (req, res) => {
  const { nome, cor, descricao } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do ministério' });
  const { rows } = await db.query(
    `INSERT INTO ministerios (igreja_id, nome, cor, descricao) VALUES ($1,$2,$3,$4) RETURNING *`,
    [ig(req), nome.trim(), cor || '#c9a24a', (descricao || '').trim()]
  );
  res.status(201).json(rows[0]);
});

router.put('/ministerios/:id', async (req, res) => {
  const { nome, cor, descricao, ativo } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do ministério' });
  await db.query(
    `UPDATE ministerios SET nome=$1, cor=$2, descricao=$3, ativo=$4 WHERE id=$5 AND igreja_id=$6`,
    [nome.trim(), cor || '#c9a24a', (descricao || '').trim(), ativo !== false, req.params.id, ig(req)]
  );
  res.json({ ok: true });
});

router.delete('/ministerios/:id', async (req, res) => {
  await db.query('DELETE FROM ministerios WHERE id=$1 AND igreja_id=$2', [req.params.id, ig(req)]);
  res.json({ ok: true });
});

// Define a lista de membros de um ministério (substitui a atual) + funções de cada um
router.put('/ministerios/:id/membros', async (req, res) => {
  const idMin = req.params.id;
  const ids = Array.isArray(req.body.membros) ? req.body.membros.map(Number).filter(Boolean) : [];
  const funcMap = req.body.funcoes && typeof req.body.funcoes === 'object' ? req.body.funcoes : {};
  const dono = await db.query('SELECT 1 FROM ministerios WHERE id=$1 AND igreja_id=$2', [idMin, ig(req)]);
  if (!dono.rows.length) return res.status(404).json({ erro: 'Ministério não encontrado' });
  const funcOk = new Set((await db.query('SELECT id FROM funcoes WHERE ministerio_id=$1', [idMin])).rows.map((r) => r.id));
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM ministerio_membros WHERE ministerio_id=$1', [idMin]);
    // limpa as funções deste ministério de todos, depois regrava
    await client.query('DELETE FROM membro_funcoes WHERE funcao_id IN (SELECT id FROM funcoes WHERE ministerio_id=$1)', [idMin]);
    for (const mid of ids) {
      const ok = await client.query('SELECT 1 FROM membros WHERE id=$1 AND igreja_id=$2', [mid, ig(req)]);
      if (!ok.rows.length) continue;
      await client.query('INSERT INTO ministerio_membros (ministerio_id, membro_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [idMin, mid]);
      const fns = Array.isArray(funcMap[mid]) ? funcMap[mid].map(Number).filter((f) => funcOk.has(f)) : [];
      for (const f of fns) {
        await client.query('INSERT INTO membro_funcoes (membro_id, funcao_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [mid, f]);
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true, total: ids.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e); res.status(500).json({ erro: 'Erro ao salvar membros' });
  } finally { client.release(); }
});

// ══════════════════════════════════════════════
//  EVENTOS / CULTOS
// ══════════════════════════════════════════════

const DATADO = ['evento', 'culto_especial'];
const norm = (t) => (DATADO.includes(t) ? t : 'evento');

// Lista eventos DATADOS (evento | culto especial) do mês
router.get('/eventos', async (req, res) => {
  const params = [ig(req)];
  let where = `e.igreja_id=$1 AND e.tipo IN ('evento','culto_especial')`;
  if (/^\d{4}-\d{2}$/.test(req.query.mes || '')) {
    params.push(req.query.mes + '-01');
    where += ` AND date_trunc('month', e.data) = date_trunc('month', $${params.length}::date)`;
  }
  const { rows } = await db.query(
    `SELECT e.*, to_char(e.data,'YYYY-MM-DD') AS data,
            (SELECT COUNT(*) FROM escalas s WHERE s.evento_id = e.id) AS qtd_escalados
     FROM eventos e WHERE ${where} ORDER BY e.data, e.hora`, params
  );
  res.json(rows);
});

router.post('/eventos', async (req, res) => {
  const { titulo, tipo, data, hora, observacao } = req.body;
  if (!titulo || !titulo.trim()) return res.status(400).json({ erro: 'Informe o título' });
  if (!data) return res.status(400).json({ erro: 'Informe a data' });
  const { rows } = await db.query(
    `INSERT INTO eventos (igreja_id, titulo, tipo, data, hora, observacao)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *, to_char(data,'YYYY-MM-DD') AS data`,
    [ig(req), titulo.trim(), norm(tipo), data, hora || '', (observacao || '').trim()]
  );
  res.status(201).json(rows[0]);
});

router.put('/eventos/:id', async (req, res) => {
  const { titulo, tipo, data, hora, observacao } = req.body;
  if (!titulo || !titulo.trim()) return res.status(400).json({ erro: 'Informe o título' });
  if (!data) return res.status(400).json({ erro: 'Informe a data' });
  await db.query(
    `UPDATE eventos SET titulo=$1, tipo=$2, data=$3, hora=$4, observacao=$5 WHERE id=$6 AND igreja_id=$7`,
    [titulo.trim(), norm(tipo), data, hora || '', (observacao || '').trim(), req.params.id, ig(req)]
  );
  res.json({ ok: true });
});

// ── CULTOS FIXOS (regra semanal por dia da semana) ──
router.get('/cultos-fixos', async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM cultos_fixos WHERE igreja_id=$1 AND ativo=TRUE ORDER BY dia_semana, hora', [ig(req)]
  );
  res.json(rows);
});

router.post('/cultos-fixos', async (req, res) => {
  const { titulo, dias, hora } = req.body;
  const lista = (Array.isArray(dias) ? dias : [dias]).map(Number).filter((d) => d >= 0 && d <= 6);
  if (!titulo || !titulo.trim()) return res.status(400).json({ erro: 'Informe o título' });
  if (!lista.length) return res.status(400).json({ erro: 'Selecione ao menos um dia da semana' });
  const criados = [];
  for (const d of [...new Set(lista)]) {
    const { rows } = await db.query(
      `INSERT INTO cultos_fixos (igreja_id, titulo, dia_semana, hora) VALUES ($1,$2,$3,$4) RETURNING *`,
      [ig(req), titulo.trim(), d, hora || '']
    );
    criados.push(rows[0]);
  }
  res.status(201).json({ ok: true, criados: criados.length });
});

router.put('/cultos-fixos/:id', async (req, res) => {
  const { titulo, dia_semana, hora } = req.body;
  if (!titulo || !titulo.trim()) return res.status(400).json({ erro: 'Informe o título' });
  await db.query(
    'UPDATE cultos_fixos SET titulo=$1, dia_semana=$2, hora=$3 WHERE id=$4 AND igreja_id=$5',
    [titulo.trim(), Number(dia_semana), hora || '', req.params.id, ig(req)]
  );
  res.json({ ok: true });
});

router.delete('/cultos-fixos/:id', async (req, res) => {
  await db.query('DELETE FROM cultos_fixos WHERE id=$1 AND igreja_id=$2', [req.params.id, ig(req)]);
  res.json({ ok: true });
});

// Materializa (ou acha) o evento concreto de uma ocorrência de culto fixo, p/ montar escala
router.post('/ocorrencia', async (req, res) => {
  const { culto_fixo_id, data } = req.body;
  if (!culto_fixo_id || !/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return res.status(400).json({ erro: 'Dados inválidos' });
  const fx = await db.query('SELECT * FROM cultos_fixos WHERE id=$1 AND igreja_id=$2', [culto_fixo_id, ig(req)]);
  if (!fx.rows.length) return res.status(404).json({ erro: 'Culto fixo não encontrado' });
  const ja = await db.query(
    'SELECT id FROM eventos WHERE igreja_id=$1 AND culto_fixo_id=$2 AND data=$3', [ig(req), culto_fixo_id, data]
  );
  if (ja.rows.length) return res.json({ id: ja.rows[0].id });
  const f = fx.rows[0];
  const { rows } = await db.query(
    `INSERT INTO eventos (igreja_id, titulo, tipo, data, hora, culto_fixo_id)
     VALUES ($1,$2,'culto_fixo',$3,$4,$5) RETURNING id`,
    [ig(req), f.titulo, data, f.hora, culto_fixo_id]
  );
  res.json({ id: rows[0].id });
});

router.delete('/eventos/:id', async (req, res) => {
  // ?serie=1 remove todos os cultos da mesma série semanal
  if (req.query.serie === '1') {
    const r = await db.query(
      `DELETE FROM eventos WHERE igreja_id=$1
         AND serie_id = (SELECT serie_id FROM eventos WHERE id=$2 AND igreja_id=$1)
         AND serie_id IS NOT NULL`,
      [ig(req), req.params.id]
    );
    if (r.rowCount) return res.json({ ok: true, removidos: r.rowCount });
  }
  await db.query('DELETE FROM eventos WHERE id=$1 AND igreja_id=$2', [req.params.id, ig(req)]);
  res.json({ ok: true, removidos: 1 });
});

// Escala de um evento: ministérios (que têm membros) + quem está escalado
router.get('/eventos/:id/escala', async (req, res) => {
  const evId = req.params.id;
  const ev = await db.query(
    `SELECT *, to_char(data,'YYYY-MM-DD') AS data FROM eventos WHERE id=$1 AND igreja_id=$2`,
    [evId, ig(req)]
  );
  if (!ev.rows.length) return res.status(404).json({ erro: 'Evento não encontrado' });

  const mins = await db.query('SELECT * FROM ministerios WHERE igreja_id=$1 AND ativo=TRUE ORDER BY nome', [ig(req)]);
  const esc = await db.query(
    `SELECT s.id, s.ministerio_id, s.membro_id, s.funcao, me.nome AS membro_nome
     FROM escalas s JOIN membros me ON me.id = s.membro_id
     WHERE s.evento_id=$1 ORDER BY me.nome`, [evId]
  );
  res.json({ evento: ev.rows[0], ministerios: mins.rows, escala: esc.rows });
});

// ══════════════════════════════════════════════
//  ESCALAÇÃO
// ══════════════════════════════════════════════
router.post('/escala', async (req, res) => {
  const { evento_id, ministerio_id, membro_id, funcao } = req.body;
  if (!evento_id || !ministerio_id || !membro_id)
    return res.status(400).json({ erro: 'Dados incompletos' });
  // valida que tudo pertence à igreja
  const ok = await db.query(
    `SELECT (SELECT 1 FROM eventos WHERE id=$1 AND igreja_id=$4) AS e,
            (SELECT 1 FROM ministerios WHERE id=$2 AND igreja_id=$4) AS m,
            (SELECT 1 FROM membros WHERE id=$3 AND igreja_id=$4) AS me`,
    [evento_id, ministerio_id, membro_id, ig(req)]
  );
  const v = ok.rows[0];
  if (!v.e || !v.m || !v.me) return res.status(400).json({ erro: 'Registro inválido' });
  try {
    const { rows } = await db.query(
      `INSERT INTO escalas (igreja_id, evento_id, ministerio_id, membro_id, funcao)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [ig(req), evento_id, ministerio_id, membro_id, (funcao || '').trim()]
    );
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ erro: 'Esta pessoa já está escalada neste ministério.' });
    console.error(e); res.status(500).json({ erro: 'Erro ao escalar' });
  }
});

router.delete('/escala/:id', async (req, res) => {
  await db.query('DELETE FROM escalas WHERE id=$1 AND igreja_id=$2', [req.params.id, ig(req)]);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════
//  CALENDÁRIO — eventos do mês com escala agrupada por ministério
// ══════════════════════════════════════════════
router.get('/calendario', async (req, res) => {
  const igId = ig(req);
  const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : new Date().toISOString().slice(0, 7);

  // 1) eventos concretos do mês (datados + ocorrências de culto fixo já materializadas)
  const { rows: concretos } = await db.query(
    `SELECT e.id, e.titulo, e.tipo, e.hora, e.culto_fixo_id, to_char(e.data,'YYYY-MM-DD') AS data,
            COALESCE(json_agg(json_build_object('ministerio', mi.nome, 'cor', mi.cor, 'membro', me.nome)
              ORDER BY mi.nome, me.nome) FILTER (WHERE s.id IS NOT NULL), '[]') AS escalados
     FROM eventos e
     LEFT JOIN escalas s      ON s.evento_id = e.id
     LEFT JOIN ministerios mi ON mi.id = s.ministerio_id
     LEFT JOIN membros me     ON me.id = s.membro_id
     WHERE e.igreja_id=$1 AND date_trunc('month', e.data) = date_trunc('month', ($2||'-01')::date)
     GROUP BY e.id ORDER BY e.data, e.hora`,
    [igId, mes]
  );

  // 2) regras de culto fixo → expande em ocorrências virtuais no mês (menos as já materializadas)
  const { rows: fixos } = await db.query('SELECT * FROM cultos_fixos WHERE igreja_id=$1 AND ativo=TRUE', [igId]);
  const materializado = new Set(concretos.filter((e) => e.culto_fixo_id).map((e) => e.culto_fixo_id + '|' + e.data));

  const [ano, m] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const virtuais = [];
  for (const f of fixos) {
    for (let dia = 1; dia <= diasNoMes; dia++) {
      if (new Date(ano, m - 1, dia).getDay() !== f.dia_semana) continue;
      const data = `${mes}-${String(dia).padStart(2, '0')}`;
      if (materializado.has(f.id + '|' + data)) continue;
      virtuais.push({ id: null, fixo_id: f.id, titulo: f.titulo, tipo: 'culto_fixo', hora: f.hora, data, escalados: [] });
    }
  }

  const eventos = [...concretos, ...virtuais].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  res.json({ mes, eventos });
});

// ══════════════════════════════════════════════
//  MEMBROS — quem está em algum ministério + próximas escalas
// ══════════════════════════════════════════════
router.get('/membros', async (req, res) => {
  const igId = ig(req);
  // membros que estão em >= 1 ministério
  const membros = await db.query(
    `SELECT DISTINCT me.id, me.nome, me.telefone
     FROM membros me JOIN ministerio_membros mm ON mm.membro_id = me.id
     JOIN ministerios mi ON mi.id = mm.ministerio_id
     WHERE me.igreja_id=$1 ORDER BY me.nome`, [igId]
  );
  // ministérios de cada um
  const mins = await db.query(
    `SELECT mm.membro_id, mi.nome, mi.cor
     FROM ministerio_membros mm JOIN ministerios mi ON mi.id = mm.ministerio_id
     WHERE mi.igreja_id=$1`, [igId]
  );
  // próximas escalas (de hoje em diante)
  const prox = await db.query(
    `SELECT s.membro_id, to_char(e.data,'YYYY-MM-DD') AS data, e.titulo, e.hora, mi.nome AS ministerio, mi.cor
     FROM escalas s JOIN eventos e ON e.id = s.evento_id JOIN ministerios mi ON mi.id = s.ministerio_id
     WHERE s.igreja_id=$1 AND e.data >= CURRENT_DATE
     ORDER BY e.data, e.hora`, [igId]
  );
  const porMembro = {};
  membros.rows.forEach((m) => (porMembro[m.id] = { ...m, ministerios: [], proximas: [] }));
  mins.rows.forEach((r) => porMembro[r.membro_id]?.ministerios.push({ nome: r.nome, cor: r.cor }));
  prox.rows.forEach((r) => porMembro[r.membro_id]?.proximas.push(r));
  res.json(Object.values(porMembro));
});

module.exports = router;
