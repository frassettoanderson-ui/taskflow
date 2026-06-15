const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db');
const router = express.Router();

const COLUNAS = [
  'DATA DE TRANSAÇÃO', 'BANCO', 'SITUAÇÃO', 'DESCRIÇÃO', 'DETALHES DO LANÇAMENTO',
  'VALOR (R$)', 'FORMA DE PAGAMENTO', 'PARCELAMENTO', 'PARCELAS',
  'CLIENTE/FORNECEDOR', 'CENTRO DE CUSTO', 'TIPO DO GASTO',
];
const SIT = { recebido: 'Recebido', pago: 'Pago', pendente: 'Pendente' };
const dataBR = (d) => String(d).slice(0, 10).split('-').reverse().join('/');

// GET /api/exportar?mes=YYYY-MM  → baixa o xlsx no formato da contabilidade
router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);

  const { rows } = await db.query(
    `SELECT l.*, b.nome AS banco_nome, m.nome AS membro_nome,
            f.nome AS fornecedor_nome, cc.nome AS centro_custo_nome
     FROM lancamentos l
     JOIN bancos b ON b.id=l.banco_id
     LEFT JOIN membros m ON m.id=l.membro_id
     LEFT JOIN fornecedores f ON f.id=l.fornecedor_id
     LEFT JOIN centros_custo cc ON cc.id=l.centro_custo_id
     WHERE l.igreja_id=$1 AND date_trunc('month', l.data)=date_trunc('month', $2::date)
     ORDER BY l.data ASC, l.id ASC`,
    [igreja_id, mes + '-01']
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Envio Contabilidade');
  ws.addRow(COLUNAS);
  ws.getRow(1).font = { bold: true };

  for (const l of rows) {
    const ehEntrada = l.tipo === 'entrada';
    const valor = ehEntrada ? Number(l.valor) : -Number(l.valor);
    const clienteForn = ehEntrada
      ? (l.visitante ? 'VISITANTE' : (l.membro_nome || ''))
      : (l.fornecedor_nome || '');
    ws.addRow([
      dataBR(l.data),
      l.banco_nome,
      SIT[l.situacao] || l.situacao,
      l.descricao || (ehEntrada ? 'RECEITA PIX' : 'FORNECEDOR'),
      l.detalhes || '',
      valor,
      l.forma_pagamento || 'Pix',
      l.parcelamento || 'À vista',
      l.parcela_label || '',
      clienteForn,
      ehEntrada ? '' : (l.centro_custo_nome || ''),
      l.tipo_gasto || '',
    ]);
  }

  // Largura amigável
  ws.columns.forEach((c) => { c.width = 18; });
  ws.getColumn(6).numFmt = '#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="envio_contabilidade_${mes}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
