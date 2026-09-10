'use strict';
/**
 * Exemplo: como o PDV (Express) emite a nota ao finalizar a venda.
 * O cliente já lê EMISSOR_URL / EMISSOR_API_KEY / EMISSOR_EMITENTE do .env.
 */
const { EmissorFiscal, EmissorFiscalError } = require('./emissorFiscal');

const fiscal = new EmissorFiscal(); // usa as envs

// --- Rota de exemplo no PDV ---
// app.post('/vendas/:id/emitir-cupom', emitirCupom);
async function emitirCupom(req, res) {
  const venda = req.venda; // a venda já gravada no seu banco

  // 1) traduz a SUA venda para o payload normalizado do motor
  const payload = {
    consumidor: venda.cpfCliente ? { cpf: venda.cpfCliente } : undefined,
    itens: venda.itens.map((i) => ({
      codigo: i.sku,
      descricao: i.nome,
      ncm: i.ncm,
      cfop: '5102',
      unidade: 'UN',
      quantidade: i.qtd,
      valor_unitario: i.preco,
      origem: 0,
      csosn: '102',
    })),
    pagamentos: venda.pagamentos.map((p) => ({ forma: p.tipo, valor: p.valor })),
  };

  // 2) emite — uma linha
  try {
    const nota = await fiscal.emitirNFCe(payload);
    // 3) guarda no seu banco e devolve pro caixa
    await salvarNaVenda(venda.id, { chave: nota.chave, status: nota.status });
    const pdf = await fiscal.danfce(nota.chave); // { pdf_base64 } para imprimir
    return res.json({ ok: true, chave: nota.chave, pdfBase64: pdf.pdf_base64 });
  } catch (e) {
    if (e instanceof EmissorFiscalError) {
      // rejeição fiscal — mostra o motivo pro operador
      return res.status(422).json({ ok: false, motivo: e.message, detalhe: e.resposta });
    }
    throw e; // erro de rede/inesperado
  }
}

// Cliente pediu NF-e depois do cupom? (dentro do prazo)
async function trocarPorNFe(req, res) {
  const { chaveNfce, protocoloNfce, cnpjCliente, nomeCliente, endereco } = req.body;
  const r = await fiscal.substituirNfcePorNfe({
    chave: chaveNfce,
    protocolo: protocoloNfce,
    destinatario: { cnpj: cnpjCliente, nome: nomeCliente, endereco },
  });
  return res.json(r); // cancela a NFC-e e emite a NF-e referenciando
}

async function salvarNaVenda() { /* seu ORM aqui */ }

module.exports = { emitirCupom, trocarPorNFe };
