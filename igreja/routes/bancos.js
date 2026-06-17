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

// Extrato bancário: movimentações realizadas (entradas recebidas + saídas pagas) de um banco no mês
router.get('/:id/extrato', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const id = req.params.id;
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);
  const ini = mes + '-01';

  const { rows: brows } = await db.query(
    'SELECT * FROM bancos WHERE id=$1 AND igreja_id=$2', [id, igreja_id]);
  if (!brows.length) return res.status(404).json({ erro: 'Banco não encontrado' });
  const banco = brows[0];

  // Saldo antes do mês (saldo inicial + movimentações realizadas anteriores)
  const { rows: ar } = await db.query(
    `SELECT COALESCE(SUM(CASE WHEN tipo='entrada' AND situacao='recebido' THEN valor
                              WHEN tipo='saida'   AND situacao='pago'     THEN -valor ELSE 0 END),0) AS saldo
     FROM lancamentos
     WHERE banco_id=$1 AND igreja_id=$2 AND data < $3`,
    [id, igreja_id, ini]
  );
  const saldoAnterior = Number(banco.saldo_inicial) + Number(ar[0].saldo);

  const { rows: mov } = await db.query(
    `SELECT l.id, l.tipo, l.data, l.valor, l.descricao, l.detalhes, l.tipo_gasto, l.parcela_label,
            m.nome AS membro_nome, l.visitante, f.nome AS fornecedor_nome, cc.nome AS centro_nome
     FROM lancamentos l
     LEFT JOIN membros m ON m.id = l.membro_id
     LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
     LEFT JOIN centros_custo cc ON cc.id = l.centro_custo_id
     WHERE l.banco_id=$1 AND l.igreja_id=$2
       AND date_trunc('month', l.data) = date_trunc('month', $3::date)
       AND ((l.tipo='entrada' AND l.situacao='recebido') OR (l.tipo='saida' AND l.situacao='pago'))
     ORDER BY l.data ASC, l.id ASC`,
    [id, igreja_id, ini]
  );

  let saldo = saldoAnterior;
  const movimentos = mov.map((l) => {
    const valor = l.tipo === 'entrada' ? Number(l.valor) : -Number(l.valor);
    saldo += valor;
    const desc = l.tipo === 'entrada'
      ? `${l.tipo_gasto} — ${l.visitante ? 'Visitante' : (l.membro_nome || '')}`
      : `${l.fornecedor_nome || 'Despesa'}${l.centro_nome ? ' — ' + l.centro_nome : ''}${l.parcela_label ? ' (' + l.parcela_label + ')' : ''}`;
    return { id: l.id, data: l.data, tipo: l.tipo, descricao: desc.trim(), valor, saldo };
  });

  res.json({
    banco: { id: banco.id, nome: banco.nome },
    mes, saldo_anterior: saldoAnterior, saldo_final: saldo, movimentos,
  });
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
