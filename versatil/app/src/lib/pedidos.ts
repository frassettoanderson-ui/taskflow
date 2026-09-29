// Núcleo de pedidos + estoque.
// Regra de ouro: toda mudança de estoque é um UPDATE condicional (WHERE disponivel >= q) e toda
// mudança de status é compare-and-set (WHERE status = esperado). Assim duas compras simultâneas
// da última unidade nunca passam juntas, e webhook x job de expiração não se atropelam.
import { randomBytes } from "node:crypto";
import { Prisma, type FormaPagamento, type StatusPedido } from "@prisma/client";
import { db } from "./db";
import { getConfig } from "./config";
import { cpfValido, soDigitos } from "./format";
import { criarCobranca, estornarCobranca, garantirCliente, removerCobranca } from "./asaas";
import { lancarEstorno, lancarReceitaVenda, movimentarEstoqueLog } from "./registros";

type Tx = Prisma.TransactionClient;
type Item = { produtoId: string; quantidade: number };

export class ErroIndisponivel extends Error {
  constructor(public titulo: string, public produtoId?: string) {
    super(`"${titulo}" acabou de ser reservado por outra pessoa.`);
  }
}
export class ErroValidacao extends Error {}

const STATUS_PAGOS: StatusPedido[] = ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO"];

async function evento(tx: Tx, pedidoId: string, tipo: string, descricao: string, autor = "sistema") {
  await tx.eventoPedido.create({ data: { pedidoId, tipo, descricao, autor } });
}

// ---------- operações de estoque (sempre dentro de transação) ----------

async function reservar(tx: Tx, itens: { produtoId: string; quantidade: number; titulo: string }[]) {
  // ordem fixa evita deadlock entre dois carrinhos com os mesmos produtos
  for (const it of [...itens].sort((a, b) => a.produtoId.localeCompare(b.produtoId))) {
    const r = await tx.produto.updateMany({
      where: { id: it.produtoId, status: "ATIVO", estoqueDisponivel: { gte: it.quantidade } },
      data: { estoqueDisponivel: { decrement: it.quantidade }, estoqueReservado: { increment: it.quantidade } },
    });
    if (r.count === 0) throw new ErroIndisponivel(it.titulo, it.produtoId);
  }
}

async function liberarReserva(tx: Tx, itens: Item[]) {
  for (const it of itens)
    await tx.produto.update({
      where: { id: it.produtoId },
      data: { estoqueReservado: { decrement: it.quantidade }, estoqueDisponivel: { increment: it.quantidade } },
    });
}

async function marcarEsgotados(tx: Tx, ids: string[]) {
  await tx.produto.updateMany({
    where: { id: { in: ids }, status: "ATIVO", estoqueDisponivel: 0, estoqueReservado: 0 },
    data: { status: "ESGOTADO" },
  });
}

async function reservadoParaVendido(tx: Tx, itens: Item[]) {
  for (const it of itens)
    await tx.produto.update({
      where: { id: it.produtoId },
      data: { estoqueReservado: { decrement: it.quantidade }, vendidos: { increment: it.quantidade }, ultimaVendaEm: new Date() },
    });
  await marcarEsgotados(tx, itens.map((i) => i.produtoId));
}

async function vendidoParaDisponivel(tx: Tx, itens: Item[]) {
  for (const it of itens) {
    await tx.produto.update({
      where: { id: it.produtoId },
      data: { vendidos: { decrement: it.quantidade }, estoqueDisponivel: { increment: it.quantidade } },
    });
    await tx.produto.updateMany({ where: { id: it.produtoId, status: "ESGOTADO" }, data: { status: "ATIVO" } });
  }
}

// ---------- criar pedido (checkout online) ----------

export async function criarPedido(input: {
  nome: string;
  telefone: string;
  cpf: string;
  email?: string;
  metodo: "PIX" | "CARTAO";
  itens: Item[];
  origemGrupo?: string | null;
}) {
  const nome = input.nome.trim();
  const telefone = soDigitos(input.telefone);
  const cpf = soDigitos(input.cpf);
  if (nome.length < 3) throw new ErroValidacao("Informe seu nome completo.");
  if (telefone.length < 10) throw new ErroValidacao("Informe um WhatsApp válido com DDD.");
  if (!cpfValido(cpf)) throw new ErroValidacao("CPF inválido.");

  const qtd = new Map<string, number>();
  for (const i of input.itens) {
    const q = Math.floor(Number(i.quantidade));
    if (q > 0) qtd.set(i.produtoId, (qtd.get(i.produtoId) || 0) + q);
  }
  if (!qtd.size) throw new ErroValidacao("Carrinho vazio.");

  const produtos = await db.produto.findMany({ where: { id: { in: [...qtd.keys()] } } });
  if (produtos.length !== qtd.size) throw new ErroValidacao("Algum produto do carrinho não existe mais.");
  const itens = produtos.map((p) => ({
    produtoId: p.id,
    quantidade: qtd.get(p.id)!,
    precoUnitCents: p.precoCents, // preço sempre do banco, nunca do navegador
    custoUnitCents: p.custoCents,
    titulo: p.titulo,
  }));
  const total = itens.reduce((s, i) => s + i.quantidade * i.precoUnitCents, 0);

  const cfg = await getConfig();
  const minutos = Number(input.metodo === "PIX" ? cfg.reserva_pix_min : cfg.reserva_cartao_min) || 15;
  // taxa de serviço da software house: definida só no servidor (.env), nunca pelo painel da loja
  const splitPercent = Number(process.env.ASAAS_SPLIT_PERCENT) || null;

  const pedido = await db.$transaction(async (tx) => {
    await reservar(tx, itens);
    const cliente = await tx.cliente.upsert({
      where: { telefone },
      create: { nome, telefone, cpf, email: input.email || null },
      update: { nome, cpf, email: input.email || undefined },
    });
    const p = await tx.pedido.create({
      data: {
        acessoToken: randomBytes(16).toString("hex"),
        clienteId: cliente.id,
        metodo: input.metodo,
        totalCents: total,
        splitPercent,
        expiraEm: new Date(Date.now() + minutos * 60_000),
        origemGrupo: input.origemGrupo || null,
        itens: { create: itens },
      },
      include: { cliente: true },
    });
    await evento(tx, p.id, "criado", `Pedido criado (${input.metodo === "PIX" ? "Pix" : "cartão"}), reserva de ${minutos} min`, "cliente");
    return p;
  });

  try {
    const customerId =
      pedido.cliente.asaasCustomerId ||
      (await garantirCliente({ nome, cpf, telefone, email: input.email }));
    if (customerId !== pedido.cliente.asaasCustomerId)
      await db.cliente.update({ where: { id: pedido.clienteId }, data: { asaasCustomerId: customerId } });
    const cob = await criarCobranca({
      customerId,
      metodo: input.metodo,
      valorCents: total,
      descricao: `Versátil — pedido #${pedido.numero}`,
      referencia: pedido.id,
      splitPercent,
    });
    return await db.pedido.update({
      where: { id: pedido.id },
      data: { asaasPaymentId: cob.id, pixPayload: cob.pixPayload, invoiceUrl: cob.invoiceUrl },
    });
  } catch (e) {
    await encerrarAguardando(pedido.id, "CANCELADO", "Falha ao gerar cobrança: " + (e as Error).message);
    throw e;
  }
}

// ---------- pagamento confirmado (webhook Asaas ou simulação no modo demo) ----------

type PedidoPago = { id: string; numero: number; canal: "ONLINE" | "PDV"; metodo: string; totalCents: number; caixaId: string | null; operador: string | null };

/** Tudo que acontece quando um pagamento é confirmado: log de estoque, receita no financeiro e, no balcão, finaliza a venda. */
async function posPagamento(tx: Tx, pedido: PedidoPago, itens: Item[]) {
  const pdv = pedido.canal === "PDV";
  await movimentarEstoqueLog(tx, itens, pdv ? "VENDA_PDV" : "VENDA_ONLINE", -1, { pedidoId: pedido.id, usuario: pedido.operador ?? "sistema" });
  const forma = pedido.metodo === "CARTAO" ? "CREDITO" : "PIX_ASAAS";
  await lancarReceitaVenda(tx, { pedidoId: pedido.id, numero: pedido.numero, valorCents: pedido.totalCents, forma, online: !pdv, usuario: pedido.operador ?? "sistema" });
  if (pdv) {
    // venda de balcão paga no Pix automático: cliente já está com o produto
    await tx.pedido.update({ where: { id: pedido.id }, data: { status: "RETIRADO", retiradoEm: new Date() } });
    await tx.pagamentoPedido.create({ data: { pedidoId: pedido.id, forma: "PIX_ASAAS", valorCents: pedido.totalCents } });
    if (pedido.caixaId)
      await tx.movimentoCaixa.create({
        data: { caixaId: pedido.caixaId, tipo: "VENDA", forma: "PIX_ASAAS", valorCents: pedido.totalCents, descricao: `Venda #${pedido.numero} (Pix)`, pedidoId: pedido.id, usuario: pedido.operador ?? "sistema" },
      });
  }
}

export async function processarPagamento(asaasPaymentId: string, fonte = "asaas") {
  const pedido = await db.pedido.findUnique({ where: { asaasPaymentId }, include: { itens: true } });
  if (!pedido) return { ok: false, motivo: "pedido não encontrado" };
  if (STATUS_PAGOS.includes(pedido.status) || pedido.status === "ESTORNADO") return { ok: true, motivo: "já processado" };

  const itens = pedido.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, titulo: i.titulo }));

  if (pedido.status === "AGUARDANDO_PAGAMENTO") {
    const ok = await db.$transaction(async (tx) => {
      const cas = await tx.pedido.updateMany({
        where: { id: pedido.id, status: "AGUARDANDO_PAGAMENTO" },
        data: { status: "PAGO", pagoEm: new Date() },
      });
      if (!cas.count) return false;
      await reservadoParaVendido(tx, itens);
      await posPagamento(tx, pedido, itens);
      await evento(tx, pedido.id, "pago", "Pagamento confirmado", fonte);
      return true;
    });
    if (ok) return { ok: true };
    return processarPagamento(asaasPaymentId, fonte); // status mudou no meio (ex.: expirou) — reavalia
  }

  // Pagou depois que a reserva expirou/cancelou: tenta pegar o estoque de novo.
  try {
    await db.$transaction(async (tx) => {
      const cas = await tx.pedido.updateMany({
        where: { id: pedido.id, status: pedido.status },
        data: { status: "PAGO", pagoEm: new Date() },
      });
      if (!cas.count) throw new Error("status mudou");
      await reservar(tx, itens);
      await reservadoParaVendido(tx, itens);
      await posPagamento(tx, pedido, itens);
      await evento(tx, pedido.id, "pago", "Pagamento chegou após a reserva vencer — estoque ainda disponível, venda confirmada", fonte);
    });
    return { ok: true };
  } catch (e) {
    if (!(e instanceof ErroIndisponivel)) throw e;
    // Produto já foi vendido para outra pessoa: estorna automaticamente.
    await estornarCobranca(asaasPaymentId, undefined, "Produto já vendido — estorno automático");
    await db.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id: pedido.id },
        data: {
          status: "ESTORNADO",
          estornoCents: pedido.totalCents,
          estornadoEm: new Date(),
          alerta: `Venda dupla evitada: "${e.titulo}" já tinha sido vendido. Valor estornado automaticamente.`,
        },
      });
      await evento(tx, pedido.id, "estorno_auto", `Venda dupla evitada — estorno automático (${e.titulo})`, "sistema");
    });
    return { ok: false, motivo: "estornado: venda dupla evitada" };
  }
}

// ---------- expirar / cancelar ----------

async function encerrarAguardando(pedidoId: string, para: "EXPIRADO" | "CANCELADO", motivo: string, autor = "sistema") {
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, include: { itens: true } });
  if (!pedido) return false;
  const ok = await db.$transaction(async (tx) => {
    const cas = await tx.pedido.updateMany({ where: { id: pedidoId, status: "AGUARDANDO_PAGAMENTO" }, data: { status: para } });
    if (!cas.count) return false;
    await liberarReserva(tx, pedido.itens);
    await evento(tx, pedidoId, para.toLowerCase(), motivo, autor);
    return true;
  });
  if (ok && pedido.asaasPaymentId) await removerCobranca(pedido.asaasPaymentId).catch(() => {});
  return ok;
}

export const cancelarPedido = (pedidoId: string, autor: string) =>
  encerrarAguardando(pedidoId, "CANCELADO", "Pedido cancelado antes do pagamento — reserva liberada", autor);

let ultimaVarredura = 0;
export async function expirarPedidos(forcar = false) {
  if (!forcar && Date.now() - ultimaVarredura < 20_000) return 0;
  ultimaVarredura = Date.now();
  const vencidos = await db.pedido.findMany({
    where: { status: "AGUARDANDO_PAGAMENTO", expiraEm: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  let n = 0;
  for (const p of vencidos) if (await encerrarAguardando(p.id, "EXPIRADO", "Reserva expirou sem pagamento — produto voltou para a loja")) n++;
  return n;
}

// ---------- operação no painel ----------

const FLUXO: Record<string, StatusPedido[]> = {
  SEPARANDO: ["PAGO"],
  PRONTO: ["PAGO", "SEPARANDO"],
  RETIRADO: ["PAGO", "SEPARANDO", "PRONTO"],
};

export async function avancarStatus(pedidoId: string, para: "SEPARANDO" | "PRONTO" | "RETIRADO", autor: string) {
  return db.$transaction(async (tx) => {
    const cas = await tx.pedido.updateMany({
      where: { id: pedidoId, status: { in: FLUXO[para] } },
      data: { status: para, ...(para === "RETIRADO" ? { retiradoEm: new Date() } : {}) },
    });
    if (!cas.count) return false;
    const txt = { SEPARANDO: "Em separação", PRONTO: "Pronto para retirada", RETIRADO: "Retirado pelo cliente" }[para];
    await evento(tx, pedidoId, para.toLowerCase(), txt, autor);
    return true;
  });
}

export async function estornarPedido(pedidoId: string, opts: { valorCents?: number; devolverEstoque: boolean; motivo?: string; autor: string; forma?: FormaPagamento }) {
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, include: { itens: true, pagamentos: true } });
  if (!pedido) throw new ErroValidacao("Pedido não encontrado.");
  if (!STATUS_PAGOS.includes(pedido.status)) throw new ErroValidacao("Só é possível estornar pedidos pagos.");
  const restante = pedido.totalCents - pedido.estornoCents;
  const valor = opts.valorCents ?? restante;
  if (valor <= 0 || valor > restante) throw new ErroValidacao("Valor de estorno inválido.");
  const total = valor === restante;

  if (pedido.asaasPaymentId) await estornarCobranca(pedido.asaasPaymentId, total && !pedido.estornoCents ? undefined : valor, opts.motivo);

  await db.$transaction(async (tx) => {
    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        estornoCents: { increment: valor },
        estornadoEm: new Date(),
        ...(total ? { status: "ESTORNADO" } : {}),
      },
    });
    if (total && opts.devolverEstoque) {
      await vendidoParaDisponivel(tx, pedido.itens);
      await movimentarEstoqueLog(tx, pedido.itens, "ESTORNO", 1, { pedidoId, usuario: opts.autor, motivo: opts.motivo });
    }
    // financeiro: devolução ao cliente (no balcão, pela forma principal usada na venda)
    const pdv = pedido.canal === "PDV";
    const formaPrincipal = pdv ? (opts.forma ?? [...pedido.pagamentos].sort((a, b) => b.valorCents - a.valorCents)[0]?.forma ?? "DINHEIRO") : pedido.metodo === "CARTAO" ? "CREDITO" : "PIX_ASAAS";
    await lancarEstorno(tx, { pedidoId, numero: pedido.numero, valorCents: valor, forma: formaPrincipal, online: !pdv, usuario: opts.autor, motivo: opts.motivo });
    if (pdv && formaPrincipal === "DINHEIRO") {
      const aberto = await tx.caixaSessao.findFirst({ where: { status: "ABERTO" }, orderBy: { abertoEm: "desc" } });
      if (aberto)
        await tx.movimentoCaixa.create({
          data: { caixaId: aberto.id, tipo: "ESTORNO", forma: "DINHEIRO", valorCents: -valor, descricao: `Devolução da venda #${pedido.numero}`, pedidoId, usuario: opts.autor },
        });
    }
    const reais = (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    await evento(
      tx,
      pedidoId,
      "estorno",
      `Estorno ${total ? "total" : "parcial"} de ${reais}${total && opts.devolverEstoque ? " — itens voltaram ao estoque" : ""}${opts.motivo ? ` · ${opts.motivo}` : ""}`,
      opts.autor,
    );
  });
}
