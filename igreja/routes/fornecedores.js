const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const busca = (req.query.busca || '').trim();
  const params = [igreja_id];
  let where = 'igreja_id=$1 AND ativo=TRUE';
  if (busca) { params.push('%' + busca + '%'); where += ` AND nome ILIKE $${params.length}`; }
  const { rows } = await db.query(`SELECT * FROM fornecedores WHERE ${where} ORDER BY nome`, params);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { nome, telefone, documento, endereco, observacao } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const { rows } = await db.query(
    `INSERT INTO fornecedores (igreja_id, nome, telefone, documento, endereco, observacao)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [igreja_id, nome.trim(), telefone || '', documento || '', endereco || '', observacao || '']
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { nome, telefone, documento, endereco, observacao } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  await db.query(
    `UPDATE fornecedores SET nome=$1, telefone=$2, documento=$3, endereco=$4, observacao=$5
     WHERE id=$6 AND igreja_id=$7`,
    [nome.trim(), telefone || '', documento || '', endereco || '', observacao || '', req.params.id, igreja_id]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  await db.query('UPDATE fornecedores SET ativo=FALSE WHERE id=$1 AND igreja_id=$2', [req.params.id, igreja_id]);
  res.json({ ok: true });
});

module.exports = router;
