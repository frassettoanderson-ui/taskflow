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
    `SELECT me.id, me.nome, me.telefone FROM ministerio_membros mm
     JOIN membros me ON me.id = mm.membro_id
     WHERE mm.ministerio_id=$1 ORDER BY me.nome`, [req.params.id]
  );
  res.json({ ...rows[0], membros: membros.rows });
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

// Define a lista de membros de um ministério (substitui a atual)
router.put('/ministerios/:id/membros', async (req, res) => {
  const idMin = req.params.id;
  const ids = Array.isArray(req.body.membros) ? req.body.membros.map(Number).filter(Boolean) : [];
  const dono = await db.query('SELECT 1 FROM ministerios WHERE id=$1 AND igreja_id=$2', [idMin, ig(req)]);
  if (!dono.rows.length) return res.status(404).json({ erro: 'Ministério não encontrado' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM ministerio_membros WHERE ministerio_id=$1', [idMin]);
    for (const mid of ids) {
      await client.query(
        `INSERT INTO ministerio_membros (ministerio_id, membro_id)
         SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM membros WHERE id=$2 AND igreja_id=$3)
         ON CONFLICT DO NOTHING`,
        [idMin, mid, ig(req)]
      );
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

// Lista eventos (opcional ?mes=YYYY-MM); traz total de escalados
router.get('/eventos', async (req, res) => {
  const params = [ig(req)];
  let where = 'e.igreja_id=$1';
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
  const { titulo, tipo, data, hora, observacao, semanal, repetir_ate } = req.body;
  if (!titulo || !titulo.trim()) return res.status(400).json({ erro: 'Informe o título' });
  if (!data) return res.status(400).json({ erro: 'Informe a data' });
  const t = tipo === 'evento' ? 'evento' : 'culto';
  const vals = [ig(req), titulo.trim(), t, hora || '', (observacao || '').trim()];

  // Culto semanal: gera uma ocorrência por semana (mesmo dia/horário) até a data-limite
  if (t === 'culto' && semanal && /^\d{4}-\d{2}-\d{2}$/.test(repetir_ate || '') && repetir_ate > data) {
    const datas = [];
    for (let d = data; d <= repetir_ate && datas.length < 104; d = addDias(d, 7)) datas.push(d);
    const serie = crypto.randomUUID();
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const dd of datas) {
        await client.query(
          `INSERT INTO eventos (igreja_id, titulo, tipo, data, hora, observacao, serie_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [vals[0], vals[1], vals[2], dd, vals[3], vals[4], serie]
        );
      }
      await client.query('COMMIT');
      return res.status(201).json({ criados: datas.length, serie: true, data: datas[0] });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(e); return res.status(500).json({ erro: 'Erro ao gerar a série' });
    } finally { client.release(); }
  }

  const { rows } = await db.query(
    `INSERT INTO eventos (igreja_id, titulo, tipo, data, hora, observacao)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *, to_char(data,'YYYY-MM-DD') AS data`,
    [vals[0], vals[1], vals[2], data, vals[3], vals[4]]
  );
  res.status(201).json(rows[0]);
});

router.put('/eventos/:id', async (req, res) => {
  const { titulo, tipo, data, hora, observacao } = req.body;
  if (!titulo || !titulo.trim()) return res.status(400).json({ erro: 'Informe o título' });
  if (!data) return res.status(400).json({ erro: 'Informe a data' });
  await db.query(
    `UPDATE eventos SET titulo=$1, tipo=$2, data=$3, hora=$4, observacao=$5 WHERE id=$6 AND igreja_id=$7`,
    [titulo.trim(), tipo === 'evento' ? 'evento' : 'culto', data, hora || '', (observacao || '').trim(),
     req.params.id, ig(req)]
  );
  res.json({ ok: true });
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
  const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : new Date().toISOString().slice(0, 7);
  const { rows } = await db.query(
    `SELECT e.id, e.titulo, e.tipo, e.hora, to_char(e.data,'YYYY-MM-DD') AS data,
            COALESCE(json_agg(json_build_object(
              'ministerio', mi.nome, 'cor', mi.cor, 'membro', me.nome
            ) ORDER BY mi.nome, me.nome) FILTER (WHERE s.id IS NOT NULL), '[]') AS escalados
     FROM eventos e
     LEFT JOIN escalas s     ON s.evento_id = e.id
     LEFT JOIN ministerios mi ON mi.id = s.ministerio_id
     LEFT JOIN membros me      ON me.id = s.membro_id
     WHERE e.igreja_id=$1 AND date_trunc('month', e.data) = date_trunc('month', ($2||'-01')::date)
     GROUP BY e.id ORDER BY e.data, e.hora`,
    [ig(req), mes]
  );
  res.json({ mes, eventos: rows });
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
