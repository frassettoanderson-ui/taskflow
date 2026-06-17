const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();

// ─── Listagem (filtros: mes=YYYY-MM, tipo, situacao) ───
router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { mes, tipo, situacao, inicio, fim } = req.query;
  const where = ['l.igreja_id=$1'];
  const params = [igreja_id];

  if (mes) {
    params.push(mes + '-01');
    where.push(`date_trunc('month', l.data) = date_trunc('month', $${params.length}::date)`);
  }
  if (inicio) { params.push(inicio); where.push(`l.data >= $${params.length}`); }
  if (fim) { params.push(fim); where.push(`l.data <= $${params.length}`); }
  if (tipo === 'entrada' || tipo === 'saida') { params.push(tipo); where.push(`l.tipo=$${params.length}`); }
  if (situacao) { params.push(situacao); where.push(`l.situacao=$${params.length}`); }

  const { rows } = await db.query(
    `SELECT l.*, b.nome AS banco_nome, m.nome AS membro_nome,
            f.nome AS fornecedor_nome, cc.nome AS centro_custo_nome
     FROM lancamentos l
     JOIN bancos b ON b.id = l.banco_id
     LEFT JOIN membros m ON m.id = l.membro_id
     LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
     LEFT JOIN centros_custo cc ON cc.id = l.centro_custo_id
     WHERE ${where.join(' AND ')}
     ORDER BY l.data DESC, l.id DESC`,
    params
  );
  res.json(rows);
});

// ─── ENTRADA: dízimo / oferta ───────────────────────
router.post('/entrada', async (req, res) => {
  const { igreja_id, id: usuario_id } = req.session.usuario;
  const { banco_id, data, valor, tipo_gasto, membro_id, visitante, detalhes } = req.body;

  const tg = String(tipo_gasto || '').toUpperCase();
  if (!banco_id || !data || !valor) return res.status(400).json({ erro: 'Banco, data e valor são obrigatórios' });
  if (!['DIZIMO', 'OFERTA'].includes(tg)) return res.status(400).json({ erro: 'Selecione Dízimo ou Oferta' });
  if (Number(valor) <= 0) return res.status(400).json({ erro: 'Valor deve ser maior que zero' });

  // Visitante só pode ofertar
  const ehVisitante = !!visitante;
  if (ehVisitante && tg === 'DIZIMO') return res.status(400).json({ erro: 'Visitante só pode lançar Oferta' });
  if (!ehVisitante && !membro_id) return res.status(400).json({ erro: 'Selecione o membro ou marque Visitante' });

  const { rows } = await db.query(
    `INSERT INTO lancamentos
       (igreja_id, tipo, situacao, data, banco_id, valor, descricao, detalhes,
        forma_pagamento, parcelamento, membro_id, visitante, tipo_gasto, usuario_id)
     VALUES ($1,'entrada','recebido',$2,$3,$4,'RECEITA PIX',$5,'Pix','À vista',$6,$7,$8,$9)
     RETURNING *`,
    [igreja_id, data, banco_id, valor, detalhes || '',
     ehVisitante ? null : membro_id, ehVisitante, tg, usuario_id]
  );
  res.status(201).json(rows[0]);
});

// ─── Editar ENTRADA ─────────────────────────────────
router.put('/entrada/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { banco_id, data, valor, tipo_gasto, membro_id, visitante, detalhes } = req.body;
  const tg = String(tipo_gasto || '').toUpperCase();
  if (!banco_id || !data || !valor) return res.status(400).json({ erro: 'Banco, data e valor são obrigatórios' });
  if (!['DIZIMO', 'OFERTA'].includes(tg)) return res.status(400).json({ erro: 'Selecione Dízimo ou Oferta' });
  if (Number(valor) <= 0) return res.status(400).json({ erro: 'Valor deve ser maior que zero' });
  const ehVisitante = !!visitante;
  if (ehVisitante && tg === 'DIZIMO') return res.status(400).json({ erro: 'Visitante só pode lançar Oferta' });
  if (!ehVisitante && !membro_id) return res.status(400).json({ erro: 'Selecione o membro ou marque Visitante' });

  await db.query(
    `UPDATE lancamentos SET banco_id=$1, data=$2, valor=$3, tipo_gasto=$4,
       membro_id=$5, visitante=$6, detalhes=$7
     WHERE id=$8 AND igreja_id=$9 AND tipo='entrada'`,
    [banco_id, data, valor, tg, ehVisitante ? null : membro_id, ehVisitante, detalhes || '',
     req.params.id, igreja_id]
  );
  res.json({ ok: true });
});

// ─── SAÍDA: despesa (à vista ou parcelada) ──────────
// Entra como PENDENTE; vira "pago" ao aprovar.
router.post('/saida', async (req, res) => {
  const { igreja_id, id: usuario_id } = req.session.usuario;
  const {
    fornecedor_id, banco_id, data, valor, centro_custo_id,
    forma_pagamento, detalhes, parcelado, num_parcelas, pago,
  } = req.body;

  if (!fornecedor_id || !banco_id || !data || !valor)
    return res.status(400).json({ erro: 'Fornecedor, banco, data e valor são obrigatórios' });
  if (Number(valor) <= 0) return res.status(400).json({ erro: 'Valor deve ser maior que zero' });

  const forma = forma_pagamento || 'Pix';
  const ehParcelado = !!parcelado && Number(num_parcelas) > 1;
  const n = ehParcelado ? Number(num_parcelas) : 1;
  const valorParcela = Math.round((Number(valor) / n) * 100) / 100;
  const grupo = ehParcelado ? crypto.randomUUID() : null;
  // Despesa avulsa pode já entrar paga; parcelada sempre começa pendente
  const situacao = (!ehParcelado && pago) ? 'pago' : 'pendente';

  const [yy, mm, dd] = data.split('-').map(Number);
  const criados = [];
  for (let i = 0; i < n; i++) {
    // parcelas nos meses seguintes — construído em UTC para não deslocar o dia
    const dataParcela = new Date(Date.UTC(yy, (mm - 1) + i, dd)).toISOString().slice(0, 10);
    const label = ehParcelado ? `${i + 1}/${n}` : '';
    const { rows } = await db.query(
      `INSERT INTO lancamentos
         (igreja_id, tipo, situacao, data, banco_id, valor, descricao, detalhes,
          forma_pagamento, parcelamento, parcela_label, fornecedor_id, centro_custo_id,
          tipo_gasto, grupo_parcela, usuario_id)
       VALUES ($1,'saida',$2,$3,$4,$5,'FORNECEDOR',$6,$7,$8,$9,$10,$11,'Venda',$12,$13)
       RETURNING *`,
      [igreja_id, situacao, dataParcela, banco_id, valorParcela, detalhes || '', forma,
       ehParcelado ? 'Sim' : 'À vista', label, fornecedor_id, centro_custo_id || null, grupo, usuario_id]
    );
    criados.push(rows[0]);
  }
  res.status(201).json({ ok: true, parcelas: criados.length, lancamentos: criados });
});

// ─── Marcar despesa como paga (botão "Pagar") ───────
router.patch('/:id/pagar', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  await db.query(
    `UPDATE lancamentos SET situacao='pago'
     WHERE id=$1 AND igreja_id=$2 AND tipo='saida' AND situacao='pendente'`,
    [req.params.id, igreja_id]
  );
  res.json({ ok: true });
});
// alias antigo (compatibilidade)
router.patch('/:id/aprovar', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  await db.query(
    `UPDATE lancamentos SET situacao='pago'
     WHERE id=$1 AND igreja_id=$2 AND tipo='saida' AND situacao='pendente'`,
    [req.params.id, igreja_id]
  );
  res.json({ ok: true });
});

// ─── Editar despesa ─────────────────────────────────
router.put('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { fornecedor_id, centro_custo_id, banco_id, valor, data, forma_pagamento, detalhes } = req.body;
  if (!banco_id || !data || !valor) return res.status(400).json({ erro: 'Banco, data e valor são obrigatórios' });
  if (Number(valor) <= 0) return res.status(400).json({ erro: 'Valor deve ser maior que zero' });
  await db.query(
    `UPDATE lancamentos SET fornecedor_id=$1, centro_custo_id=$2, banco_id=$3,
       valor=$4, data=$5, forma_pagamento=$6, detalhes=$7
     WHERE id=$8 AND igreja_id=$9 AND tipo='saida'`,
    [fornecedor_id || null, centro_custo_id || null, banco_id, valor, data,
     forma_pagamento || 'Pix', detalhes || '', req.params.id, igreja_id]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  await db.query('DELETE FROM lancamentos WHERE id=$1 AND igreja_id=$2', [req.params.id, igreja_id]);
  res.json({ ok: true });
});

module.exports = router;
