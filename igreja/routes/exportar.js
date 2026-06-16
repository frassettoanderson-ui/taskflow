const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../db');
const router = express.Router();

const COLUNAS = [
  'DATA DE TRANSAÇÃO', 'BANCO', 'SITUAÇÃO', 'DESCRIÇÃO', 'DETALHES DO LANÇAMENTO',
  'VALOR (R$)', 'FORMA DE PAGAMENTO', 'PARCELAMENTO', 'PARCELAS',
  'CLIENTE/FORNECEDOR', 'CENTRO DE CUSTO', 'TIPO DO GASTO',
];
const SIT = { recebido: 'Recebido', pago: 'Pago', pendente: 'Pendente' };
const dataBR = (d) => String(d).slice(0, 10).split('-').reverse().join('/');

// Resolve o intervalo a partir de ?mes=YYYY-MM ou ?inicio=...&fim=...
function resolverIntervalo(q) {
  if (q.inicio && q.fim) return { inicio: q.inicio, fim: q.fim, rotulo: `${dataBR(q.inicio)} a ${dataBR(q.fim)}` };
  const mes = q.mes || new Date().toISOString().slice(0, 7);
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, '0')}`, rotulo: mes };
}

async function buscar(igreja_id, inicio, fim) {
  const { rows } = await db.query(
    `SELECT l.*, b.nome AS banco_nome, m.nome AS membro_nome,
            f.nome AS fornecedor_nome, cc.nome AS centro_custo_nome
     FROM lancamentos l
     JOIN bancos b ON b.id=l.banco_id
     LEFT JOIN membros m ON m.id=l.membro_id
     LEFT JOIN fornecedores f ON f.id=l.fornecedor_id
     LEFT JOIN centros_custo cc ON cc.id=l.centro_custo_id
     WHERE l.igreja_id=$1 AND l.data BETWEEN $2 AND $3
     ORDER BY l.data ASC, l.id ASC`,
    [igreja_id, inicio, fim]
  );
  return rows.map((l) => {
    const ehEntrada = l.tipo === 'entrada';
    return {
      ...l,
      _valor: ehEntrada ? Number(l.valor) : -Number(l.valor),
      _cliente: ehEntrada ? (l.visitante ? 'VISITANTE' : (l.membro_nome || '')) : (l.fornecedor_nome || ''),
      _centro: ehEntrada ? '' : (l.centro_custo_nome || ''),
    };
  });
}

router.get('/', async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { inicio, fim, rotulo } = resolverIntervalo(req.query);
  const formato = (req.query.formato || 'xlsx').toLowerCase();
  const linhas = await buscar(igreja_id, inicio, fim);
  const nomeArq = `envio_contabilidade_${rotulo.replace(/[^\w-]/g, '_')}`;

  if (formato === 'pdf') return gerarPDF(res, linhas, rotulo, nomeArq);
  return gerarXLSX(res, linhas, nomeArq);
});

async function gerarXLSX(res, linhas, nomeArq) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Envio Contabilidade');
  ws.addRow(COLUNAS);
  ws.getRow(1).font = { bold: true };

  for (const l of linhas) {
    ws.addRow([
      dataBR(l.data), l.banco_nome, SIT[l.situacao] || l.situacao,
      l.descricao || (l.tipo === 'entrada' ? 'RECEITA PIX' : 'FORNECEDOR'),
      l.detalhes || '', l._valor, l.forma_pagamento || 'Pix',
      l.parcelamento || 'À vista', l.parcela_label || '',
      l._cliente, l._centro, l.tipo_gasto || '',
    ]);
  }
  ws.columns.forEach((c) => { c.width = 18; });
  ws.getColumn(6).numFmt = '#,##0.00';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArq}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

function gerarPDF(res, linhas, rotulo, nomeArq) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArq}.pdf"`);
  doc.pipe(res);

  const cols = [
    { t: 'Data', w: 52 }, { t: 'Banco', w: 60 }, { t: 'Situação', w: 52 },
    { t: 'Descrição', w: 70 }, { t: 'Valor (R$)', w: 70, r: true },
    { t: 'Forma', w: 62 }, { t: 'Cliente/Fornecedor', w: 150 },
    { t: 'Centro', w: 90 }, { t: 'Tipo', w: 70 },
  ];
  const x0 = 28;
  const totalEnt = linhas.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
  const totalSai = linhas.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0);

  doc.fontSize(15).text('Envio para a Contabilidade', x0, 26);
  doc.fontSize(9).fillColor('#555').text(`Período: ${rotulo}   |   ${linhas.length} lançamentos`, x0, 46);
  doc.fillColor('#000');

  let y = 70;
  const fmt = (v) => Number(v).toLocaleString('pt-br', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function cabecalho() {
    doc.fontSize(7.5).font('Helvetica-Bold');
    let x = x0;
    cols.forEach((c) => { doc.text(c.t, x + 2, y + 4, { width: c.w - 4, align: c.r ? 'right' : 'left' }); x += c.w; });
    doc.moveTo(x0, y + 16).lineTo(x0 + cols.reduce((s, c) => s + c.w, 0), y + 16).stroke();
    y += 20;
    doc.font('Helvetica');
  }
  cabecalho();

  for (const l of linhas) {
    if (y > 540) { doc.addPage(); y = 40; cabecalho(); }
    const vals = [
      dataBR(l.data), l.banco_nome, SIT[l.situacao] || l.situacao,
      l.descricao || (l.tipo === 'entrada' ? 'RECEITA PIX' : 'FORNECEDOR'),
      fmt(l._valor), l.forma_pagamento || 'Pix', l._cliente, l._centro, l.tipo_gasto || '',
    ];
    doc.fontSize(7).fillColor(l.tipo === 'entrada' ? '#15803d' : '#b91c1c');
    let x = x0;
    cols.forEach((c, i) => { doc.text(String(vals[i] || ''), x + 2, y, { width: c.w - 4, align: c.r ? 'right' : 'left', ellipsis: true }); x += c.w; });
    doc.fillColor('#000');
    y += 14;
  }

  y += 8;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
  doc.text(`Entradas: R$ ${fmt(totalEnt)}    Saídas: R$ ${fmt(totalSai)}    Saldo: R$ ${fmt(totalEnt - totalSai)}`, x0, y);
  doc.end();
}

module.exports = router;
