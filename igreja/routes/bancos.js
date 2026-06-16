const express = require('express');
const db = require('../db');
const router = express.Router();

// Lista bancos com saldo atual (saldo_inicial + entradas pagas/recebidas - saidas pagas)
router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { rows } = await db.query(
    `SELECT b.*,
       b.saldo_inicial
       + COALESCE(SUM(CASE WHEN l.tipo='entrada' AND l.situacao='recebido' THEN l.valor ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN l.tipo='saida'   AND l.situacao='pago'     THEN l.valor ELSE 0 END),0) AS saldo_atual
     FROM bancos b
     LEFT JOIN lancamentos l ON l.banco_id = b.id
     WHERE b.igreja_id = $1 AND b.ativo = TRUE
     GROUP BY b.id ORDER BY b.nome`,
    [igreja_id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { nome, saldo_inicial } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do banco' });
  const { rows } = await db.query(
    'INSERT INTO bancos (igreja_id, nome, saldo_inicial) VALUES ($1,$2,$3) RETURNING *',
    [igreja_id, nome.trim(), saldo_inicial || 0]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { nome, agencia, conta, chave_pix, saldo_inicial } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do banco' });
  await db.query(
    `UPDATE bancos SET nome=$1, agencia=$2, conta=$3, chave_pix=$4, saldo_inicial=$5
     WHERE id=$6 AND igreja_id=$7`,
    [nome.trim(), agencia || '', conta || '', chave_pix || '', saldo_inicial || 0, req.params.id, igreja_id]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  await db.query('UPDATE bancos SET ativo=FALSE WHERE id=$1 AND igreja_id=$2', [req.params.id, igreja_id]);
  res.json({ ok: true });
});

module.exports = router;
