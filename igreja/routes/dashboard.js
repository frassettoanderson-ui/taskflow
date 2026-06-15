const express = require('express');
const db = require('../db');
const router = express.Router();

// Soma realizada (entrada=recebido, saida=pago) de um intervalo
async function totaisMes(igreja_id, ano, mes) {
  const ini = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const { rows } = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo='entrada' AND situacao='recebido' THEN valor END),0) AS entradas,
       COALESCE(SUM(CASE WHEN tipo='saida'   AND situacao='pago'     THEN valor END),0) AS saidas
     FROM lancamentos
     WHERE igreja_id=$1 AND date_trunc('month', data)=date_trunc('month', $2::date)`,
    [igreja_id, ini]
  );
  return { entradas: Number(rows[0].entradas), saidas: Number(rows[0].saidas) };
}

// GET /api/dashboard?mes=YYYY-MM
router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const mesRef = req.query.mes || new Date().toISOString().slice(0, 7);
  const [ano, mes] = mesRef.split('-').map(Number);

  // Régua: 12 meses do ano selecionado (Jan..Dez), com totais
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const t = await totaisMes(igreja_id, ano, m);
    meses.push({ mes: `${ano}-${String(m).padStart(2, '0')}`, ...t });
  }

  const atual = await totaisMes(igreja_id, ano, mes);
  const antMes = mes === 1 ? 12 : mes - 1;
  const antAno = mes === 1 ? ano - 1 : ano;
  const anterior = await totaisMes(igreja_id, antAno, antMes);

  // Fluxo dos últimos 6 meses até o mês selecionado
  const fluxo = [];
  for (let i = 5; i >= 0; i--) {
    let y = ano, mm = mes - i;
    while (mm <= 0) { mm += 12; y -= 1; }
    const t = await totaisMes(igreja_id, y, mm);
    fluxo.push({ mes: `${y}-${String(mm).padStart(2, '0')}`, receita: t.entradas, gasto: t.saidas });
  }

  // Membros ativos
  const { rows: mb } = await db.query(
    'SELECT COUNT(*)::int AS n FROM membros WHERE igreja_id=$1 AND ativo=TRUE', [igreja_id]);

  // Saldo por banco
  const { rows: bancos } = await db.query(
    `SELECT b.nome,
       b.saldo_inicial
       + COALESCE(SUM(CASE WHEN l.tipo='entrada' AND l.situacao='recebido' THEN l.valor ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN l.tipo='saida'   AND l.situacao='pago'     THEN l.valor ELSE 0 END),0) AS saldo
     FROM bancos b LEFT JOIN lancamentos l ON l.banco_id=b.id
     WHERE b.igreja_id=$1 AND b.ativo=TRUE GROUP BY b.id ORDER BY b.nome`,
    [igreja_id]);

  // Pendentes (despesas a pagar)
  const { rows: pendentes } = await db.query(
    `SELECT l.id, l.valor, l.data, l.parcela_label, f.nome AS fornecedor
     FROM lancamentos l LEFT JOIN fornecedores f ON f.id=l.fornecedor_id
     WHERE l.igreja_id=$1 AND l.tipo='saida' AND l.situacao='pendente'
     ORDER BY l.data ASC LIMIT 25`, [igreja_id]);

  const saldoTotal = bancos.reduce((s, b) => s + Number(b.saldo), 0);

  res.json({
    mesRef, ano,
    meses,
    atual: { ...atual, saldo: atual.entradas - atual.saidas },
    anterior,
    fluxo,
    membros_ativos: mb[0].n,
    bancos: bancos.map((b) => ({ nome: b.nome, saldo: Number(b.saldo) })),
    saldo_total: saldoTotal,
    pendentes: pendentes.map((p) => ({ ...p, valor: Number(p.valor) })),
    total_pendente: pendentes.reduce((s, p) => s + Number(p.valor), 0),
  });
});

module.exports = router;
