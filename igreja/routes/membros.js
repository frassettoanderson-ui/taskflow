const express = require('express');
const db = require('../db');
const router = express.Router();

// Lista membros (filtros: busca, situacao=ativo|inativo)
router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { busca, situacao } = req.query;
  const params = [igreja_id];
  let where = 'igreja_id=$1';
  if (busca) { params.push('%' + busca.trim() + '%'); where += ` AND nome ILIKE $${params.length}`; }
  if (situacao === 'ativo') where += ' AND ativo=TRUE';
  if (situacao === 'inativo') where += ' AND ativo=FALSE';
  const { rows } = await db.query(`SELECT * FROM membros WHERE ${where} ORDER BY nome`, params);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { nome, telefone, endereco, data_nascimento, sexo } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const { rows } = await db.query(
    `INSERT INTO membros (igreja_id, nome, telefone, endereco, data_nascimento, sexo, origem)
     VALUES ($1,$2,$3,$4,$5,$6,'interno') RETURNING *`,
    [igreja_id, nome.trim(), telefone || '', endereco || '', data_nascimento || null, sexo || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { nome, telefone, endereco, data_nascimento, sexo, ativo } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  await db.query(
    `UPDATE membros SET nome=$1, telefone=$2, endereco=$3, data_nascimento=$4, sexo=$5, ativo=$6
     WHERE id=$7 AND igreja_id=$8`,
    [nome.trim(), telefone || '', endereco || '', data_nascimento || null, sexo || null,
     ativo !== false, req.params.id, igreja_id]
  );
  res.json({ ok: true });
});

// Alterna ativo/inativo
router.patch('/:id/ativo', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  await db.query(
    'UPDATE membros SET ativo = NOT ativo WHERE id=$1 AND igreja_id=$2',
    [req.params.id, igreja_id]
  );
  res.json({ ok: true });
});

// Exclui (bloqueia se houver lançamentos vinculados)
router.delete('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  try {
    await db.query('DELETE FROM membros WHERE id=$1 AND igreja_id=$2', [req.params.id, igreja_id]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') {
      return res.status(409).json({ erro: 'Este membro tem lançamentos e não pode ser excluído. Use "Inativar".' });
    }
    console.error(e);
    res.status(500).json({ erro: 'Erro ao excluir' });
  }
});

module.exports = router;
