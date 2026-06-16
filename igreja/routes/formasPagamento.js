const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { rows } = await db.query(
    'SELECT * FROM formas_pagamento WHERE igreja_id=$1 AND ativo=TRUE ORDER BY nome',
    [igreja_id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { nome } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome' });
  const { rows } = await db.query(
    'INSERT INTO formas_pagamento (igreja_id, nome) VALUES ($1,$2) RETURNING *',
    [igreja_id, nome.trim()]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  await db.query('UPDATE formas_pagamento SET ativo=FALSE WHERE id=$1 AND igreja_id=$2', [req.params.id, igreja_id]);
  res.json({ ok: true });
});

module.exports = router;
