// Loja física: sessão de caixa, venda no balcão (PDV), movimentações de estoque e compras.
// Usa o MESMO estoque da loja online, com as mesmas travas atômicas (UPDATE ... WHERE disponivel >= q).
import { randomBytes } from "node:crypto";
import type { FormaPagamento, Prisma } from "@prisma/client";
import { db } from "./db";
import { ErroIndisponivel, ErroValidacao } from "./pedidos";
import { contaDaForma, lancarReceitaVenda, movimentarEstoqueLog } from "./registros";
import { cpfValido, soDigitos } from "./format";

type Tx = Prisma.TransactionClient;

export const FORMAS: Record<FormaPagamento, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  PIX_ASAAS: "Pix (Asaas)",
  DEBITO: "Cartão de débito",
  CREDITO: "Cartão de crédito",
  OUTRO: "Outro",
};

// ---------------- caixa ----------------

export const caixaAberto = () => db.caixaSessao.findFirst({ where: { status: "ABERTO" }, orderBy: { abertoEm: "desc" } });

export async function abrirCaixa(valorInicialCents: number, usuario: string) {
  if (valorInicialCents < 0) throw new ErroValidacao("Valor de troco inválido.");
  const ja = await caixaAberto();
  if (ja) throw new ErroValidacao(`O caixa #${ja.numero} já está aberto.`);
  return db.caixaSessao.create({ data: { abertoPor: usuario, valorInicialCents } });
}

export async function movimentarCaixa(tipo: "SANGRIA" | "SUPRIMENTO", valorCents: number, descricao: string, usuario: string) {
  if (valorCents <= 0) throw new ErroValidacao("Informe um valor.");
  const cx = await caixaAberto();
  if (!cx) throw new ErroValidacao("Abra o caixa primeiro.");
  if (tipo === "SANGRIA") {
    const r = await resumoCaixa(cx.id);
    if (valorCents > r.dinheiroEsperado) throw new ErroValidacao("Sangria maior que o dinheiro na gaveta.");
  }
  return db.movimentoCaixa.create({
    data: {
      caixaId: cx.id,
      tipo,
      forma: "DINHEIRO",
      valorCents: tipo === "SANGRIA" ? -valorCents : valorCents,
      descricao: descricao || (tipo === "SANGRIA" ? "Sangria" : "Suprimento de troco"),
      usuario,
    },
  });
}

export async function resumoCaixa(caixaId: string) {
  const cx = await db.caixaSessao.findUnique({ where: { id: caixaId }, include: { movimentos: { orderBy: { criadoEm: "asc" } } } });
  if (!cx) throw new ErroValidacao("Caixa não encontrado.");
  const porForma: Record<string, number> = {};
  let vendas = 0;
  let sangrias = 0;
  let suprimentos = 0;
  let estornos = 0;
  for (const m of cx.movimentos) {
    if (m.tipo === "VENDA") {
      porForma[m.forma] = (porForma[m.forma] || 0) + m.valorCents;
      vendas += m.valorCents;
    } else if (m.tipo === "SANGRIA") sangrias += -m.valorCents;
    else if (m.tipo === "SUPRIMENTO") suprimentos += m.valorCents;
    else if (m.tipo === "ESTORNO") {
      estornos += -m.valorCents;
      porForma[m.forma] = (porForma[m.forma] || 0) + m.valorCents;
    }
  }
  const qtdVendas = await db.pedido.count({ where: { caixaId, canal: "PDV", status: { notIn: ["CANCELADO", "EXPIRADO"] } } });
  const dinheiroEsperado = cx.valorInicialCents + (porForma.DINHEIRO || 0) + suprimentos - sangrias;
  return { caixa: cx, porForma, vendas, sangrias, suprimentos, estornos, qtdVendas, dinheiroEsperado };
}

export async function fecharCaixa(contagem: Partial<Record<FormaPagamento, number>>, observacao: string, usuario: string) {
  const cx = await caixaAberto();
  if (!cx) throw new ErroValidacao("Não há caixa aberto.");
  const r = await resumoCaixa(cx.id);
  const contado = contagem.DINHEIRO ?? 0;
  const res = await db.caixaSessao.updateMany({
    where: { id: cx.id, status: "ABERTO" },
    data: {
      status: "FECHADO",
      fechadoPor: usuario,
      fechadoEm: new Date(),
      contagem: contagem as Prisma.InputJsonValue,
      esperadoCents: r.dinheiroEsperado,
      contadoCents: contado,
      diferencaCents: contado - r.dinheiroEsperado,
      observacao: observacao || null,
    },
  });
  if (!res.count) throw new ErroValidacao("O caixa já foi fechado.");
  return { ...r, contado, diferenca: contado - r.dinheiroEsperado };
}

// ---------------- venda no balcão ----------------

export type ItemPDV = { produtoId: string; quantidade: number };
export type PagamentoPDV = { forma: FormaPagamento; valorCents: number; recebidoCents?: number };

async function clienteBalcao(tx: Tx, c?: { nome?: string; telefone?: string; cpf?: string }) {
  const telefone = soDigitos(c?.telefone || "");
  const cpf = soDigitos(c?.cpf || "");
  if (cpf && !cpfValido(cpf)) throw new ErroValidacao("CPF inválido.");
  if (telefone.length >= 10) {
    return tx.cliente.upsert({
      where: { telefone },
      create: { nome: c?.nome?.trim() || "Cliente balcão", telefone, cpf: cpf || null },
      update: { ...(c?.nome?.trim() ? { nome: c.nome.trim() } : {}), ...(cpf ? { cpf } : {}) },
    });
  }
  // consumidor final (sem identificação)
  return tx.cliente.upsert({ where: { telefone: "00000000000" }, create: { nome: "Consumidor final", telefone: "00000000000" }, update: {} });
}

export async function venderNoBalcao(input: {
  itens: ItemPDV[];
  descontoCents: number;
  pagamentos: PagamentoPDV[];
  cliente?: { nome?: string; telefone?: string; cpf?: string };
  operador: string;
}) {
  const caixa = await caixaAberto();
  if (!caixa) throw new ErroValidacao("Abra o caixa antes de vender.");

  const qtd = new Map<string, number>();
  for (const i of input.itens) {
    const q = Math.floor(Number(i.quantidade));
    if (q > 0) qtd.set(i.produtoId, (qtd.get(i.produtoId) || 0) + q);
  }
  if (!qtd.size) throw new ErroValidacao("Nenhum item na venda.");
  const produtos = await db.produto.findMany({ where: { id: { in: [...qtd.keys()] } } });
  if (produtos.length !== qtd.size) throw new ErroValidacao("Algum produto não existe mais.");
  const itens = produtos.map((p) => ({ produtoId: p.id, quantidade: qtd.get(p.id)!, precoUnitCents: p.precoCents, custoUnitCents: p.custoCents, titulo: p.titulo }));
  const bruto = itens.reduce((s, i) => s + i.quantidade * i.precoUnitCents, 0);
  const desconto = Math.max(0, Math.min(Math.round(input.descontoCents || 0), bruto));
  const total = bruto - desconto;

  // pagamentos: soma precisa fechar o total; troco só existe no dinheiro
  const pags = input.pagamentos.filter((p) => p.valorCents > 0);
  if (!pags.length) throw new ErroValidacao("Informe a forma de pagamento.");
  const pagos = pags.reduce((s, p) => s + p.valorCents, 0);
  if (pagos < total) throw new ErroValidacao(`Faltam ${((total - pagos) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para fechar a venda.`);
  const excesso = pagos - total;
  const dinheiro = pags.find((p) => p.forma === "DINHEIRO");
  if (excesso > 0 && (!dinheiro || dinheiro.valorCents < excesso)) throw new ErroValidacao("Pagamento maior que o total só é permitido em dinheiro (troco).");
  const registros = pags.map((p) => {
    if (p.forma === "DINHEIRO" && excesso > 0) return { forma: p.forma, valorCents: p.valorCents - excesso, recebidoCents: p.valorCents, trocoCents: excesso };
    return { forma: p.forma, valorCents: p.valorCents, recebidoCents: null as number | null, trocoCents: 0 };
  });
  const metodo = registros.length > 1 ? "MISTO" : registros[0].forma === "DINHEIRO" ? "DINHEIRO" : registros[0].forma === "DEBITO" ? "DEBITO" : registros[0].forma === "CREDITO" ? "CARTAO" : "PIX";

  const pedido = await db.$transaction(async (tx) => {
    // baixa atômica: se outra venda (online ou balcão) levou a última unidade, esta falha
    for (const it of [...itens].sort((a, b) => a.produtoId.localeCompare(b.produtoId))) {
      const r = await tx.produto.updateMany({
        where: { id: it.produtoId, status: "ATIVO", estoqueDisponivel: { gte: it.quantidade } },
        data: { estoqueDisponivel: { decrement: it.quantidade }, vendidos: { increment: it.quantidade }, ultimaVendaEm: new Date() },
      });
      if (!r.count) throw new ErroIndisponivel(it.titulo, it.produtoId);
    }
    await tx.produto.updateMany({ where: { id: { in: itens.map((i) => i.produtoId) }, status: "ATIVO", estoqueDisponivel: 0, estoqueReservado: 0 }, data: { status: "ESGOTADO" } });

    const cliente = await clienteBalcao(tx, input.cliente);
    const agora = new Date();
    const p = await tx.pedido.create({
      data: {
        acessoToken: randomBytes(16).toString("hex"),
        clienteId: cliente.id,
        canal: "PDV",
        status: "RETIRADO",
        metodo,
        totalCents: total,
        descontoCents: desconto,
        pagoEm: agora,
        retiradoEm: agora,
        operador: input.operador,
        caixaId: caixa.id,
        itens: { create: itens },
        pagamentos: { create: registros },
        eventos: { create: { tipo: "venda_pdv", descricao: `Venda no balcão (${registros.map((r) => FORMAS[r.forma]).join(" + ")})`, autor: input.operador } },
      },
    });
    await movimentarEstoqueLog(tx, itens, "VENDA_PDV", -1, { pedidoId: p.id, usuario: input.operador });
    for (const r of registros) {
      await tx.movimentoCaixa.create({
        data: { caixaId: caixa.id, tipo: "VENDA", forma: r.forma, valorCents: r.valorCents, descricao: `Venda #${p.numero}`, pedidoId: p.id, usuario: input.operador },
      });
      await lancarReceitaVenda(tx, { pedidoId: p.id, numero: p.numero, valorCents: r.valorCents, forma: r.forma, online: false, usuario: input.operador });
    }
    return p;
  });
  return { pedido, troco: excesso, total };
}

// ---------------- estoque ----------------

export async function ajustarEstoque(produtoId: string, p: { tipo: "AJUSTE" | "PERDA"; quantidade: number; motivo: string; usuario: string }) {
  const q = Math.trunc(p.quantidade);
  if (!q) throw new ErroValidacao("Informe a quantidade.");
  if (p.tipo === "PERDA" && q > 0) throw new ErroValidacao("Perda precisa ser uma quantidade negativa.");
  await db.$transaction(async (tx) => {
    if (q < 0) {
      const r = await tx.produto.updateMany({ where: { id: produtoId, estoqueDisponivel: { gte: -q } }, data: { estoqueDisponivel: { decrement: -q } } });
      if (!r.count) throw new ErroValidacao("Não há essa quantidade disponível (itens reservados não podem ser baixados).");
      await tx.produto.updateMany({ where: { id: produtoId, status: "ATIVO", estoqueDisponivel: 0, estoqueReservado: 0 }, data: { status: "ESGOTADO" } });
    } else {
      await tx.produto.update({ where: { id: produtoId }, data: { estoqueDisponivel: { increment: q } } });
      await tx.produto.updateMany({ where: { id: produtoId, status: "ESGOTADO" }, data: { status: "ATIVO" } });
    }
    await tx.movimentoEstoque.create({ data: { produtoId, tipo: p.tipo, quantidade: q, motivo: p.motivo || null, usuario: p.usuario } });
  });
}

/** Entrada de mercadoria (compra): soma no estoque, recalcula custo médio e (opcional) gera conta a pagar. */
export async function registrarCompra(p: {
  fornecedorId?: string | null;
  itens: { produtoId: string; quantidade: number; custoUnitCents: number }[];
  notaFiscal?: string;
  observacao?: string;
  pagamento: { status: "PAGO" | "PENDENTE"; vencimento?: Date; forma?: FormaPagamento };
  usuario: string;
}) {
  const itens = p.itens.filter((i) => i.quantidade > 0);
  if (!itens.length) throw new ErroValidacao("Adicione ao menos um produto.");
  if (itens.some((i) => i.custoUnitCents < 0)) throw new ErroValidacao("Custo inválido.");
  const total = itens.reduce((s, i) => s + i.quantidade * i.custoUnitCents, 0);
  return db.$transaction(async (tx) => {
    const compra = await tx.compra.create({
      data: {
        fornecedorId: p.fornecedorId || null,
        totalCents: total,
        notaFiscal: p.notaFiscal || null,
        observacao: p.observacao || null,
        usuario: p.usuario,
        itens: { create: itens },
      },
      include: { fornecedor: true },
    });
    for (const i of itens) {
      const atual = await tx.produto.findUnique({ where: { id: i.produtoId }, select: { estoqueDisponivel: true, estoqueReservado: true, custoCents: true } });
      if (!atual) throw new ErroValidacao("Produto não encontrado.");
      const saldo = atual.estoqueDisponivel + atual.estoqueReservado;
      const custoMedio = atual.custoCents && saldo > 0 ? Math.round((atual.custoCents * saldo + i.custoUnitCents * i.quantidade) / (saldo + i.quantidade)) : i.custoUnitCents;
      await tx.produto.update({ where: { id: i.produtoId }, data: { estoqueDisponivel: { increment: i.quantidade }, custoCents: custoMedio } });
      await tx.produto.updateMany({ where: { id: i.produtoId, status: "ESGOTADO" }, data: { status: "ATIVO" } });
      await tx.movimentoEstoque.create({
        data: { produtoId: i.produtoId, tipo: "ENTRADA_COMPRA", quantidade: i.quantidade, custoUnitCents: i.custoUnitCents, compraId: compra.id, usuario: p.usuario, motivo: p.notaFiscal ? `NF ${p.notaFiscal}` : null },
      });
    }
    if (total > 0) {
      const pago = p.pagamento.status === "PAGO";
      await tx.lancamento.create({
        data: {
          tipo: "DESPESA",
          descricao: `Compra #${compra.numero}${compra.fornecedor ? ` — ${compra.fornecedor.nome}` : ""}${p.notaFiscal ? ` (NF ${p.notaFiscal})` : ""}`,
          categoria: "Compra de mercadoria",
          valorCents: total,
          vencimento: p.pagamento.vencimento ?? new Date(),
          pagoEm: pago ? new Date() : null,
          status: pago ? "PAGO" : "PENDENTE",
          forma: p.pagamento.forma,
          conta: contaDaForma(p.pagamento.forma),
          origem: "COMPRA",
          compraId: compra.id,
          usuario: p.usuario,
        },
      });
    }
    return compra;
  });
}
