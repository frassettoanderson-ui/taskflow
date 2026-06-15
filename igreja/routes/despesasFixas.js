const express = require('express');
const db = require('../db');
const router = express.Router();

// Lista modelos de despesa fixa
router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { rows } = await db.query(
    `SELECT df.*, f.nome AS fornecedor_nome, cc.nome AS centro_custo_nome, b.nome AS banco_nome
     FROM despesas_fixas df
     LEFT JOIN fornecedores f ON f.id = df.fornecedor_id
     LEFT JOIN centros_custo cc ON cc.id = df.centro_custo_id
     LEFT JOIN bancos b ON b.id = df.banco_id
     WHERE df.igreja_id=$1 AND df.ativo=TRUE
     ORDER BY df.descricao`,
    [igreja_id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { descricao, valor, dia_vencimento, fornecedor_id, centro_custo_id, banco_id, forma_pagamento } = req.body;
  if (!valor || Number(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor válido' });
  if (!banco_id) return res.status(400).json({ erro: 'Selecione o banco' });
  const { rows } = await db.query(
    `INSERT INTO despesas_fixas
       (igreja_id, descricao, valor, dia_vencimento, fornecedor_id, centro_custo_id, banco_id, forma_pagamento)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [igreja_id, descricao || '', valor, dia_vencimento || 1,
     fornecedor_id || null, centro_custo_id || null, banco_id, forma_pagamento || 'Pix']
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  await db.query('UPDATE despesas_fixas SET ativo=FALSE WHERE id=$1 AND igreja_id=$2', [req.params.id, igreja_id]);
  res.json({ ok: true });
});

// Gera os lançamentos das despesas fixas para um mês (idempotente).
// POST /api/despesas-fixas/gerar  { mes: "YYYY-MM" }
router.post('/gerar', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const mes = req.body.mes || new Date().toISOString().slice(0, 7);

  const { rows: fixas } = await db.query(
    'SELECT * FROM despesas_fixas WHERE igreja_id=$1 AND ativo=TRUE',
    [igreja_id]
  );

  let gerados = 0;
  for (const f of fixas) {
    const dia = String(Math.min(f.dia_vencimento || 1, 28)).padStart(2, '0');
    const data = `${mes}-${dia}`;
    try {
      const r = await db.query(
        `INSERT INTO lancamentos
           (igreja_id, tipo, situacao, data, banco_id, valor, descricao, detalhes,
            forma_pagamento, parcelamento, fornecedor_id, centro_custo_id, tipo_gasto, despesa_fixa_id)
         VALUES ($1,'saida','pendente',$2,$3,$4,'FORNECEDOR',$5,$6,'Recorrente',$7,$8,'Estrutura',$9)
         ON CONFLICT DO NOTHING RETURNING id`,
        [igreja_id, data, f.banco_id, f.valor, f.descricao || '', f.forma_pagamento,
         f.fornecedor_id, f.centro_custo_id, f.id]
      );
      if (r.rows.length) gerados++;
    } catch (e) { /* conflito = já gerado no mês */ }
  }
  res.json({ ok: true, gerados, mes });
});

module.exports = router;
