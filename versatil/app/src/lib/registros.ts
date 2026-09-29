// Registros automáticos que ligam vendas ao estoque (movimentações) e ao financeiro (lançamentos).
// Sempre chamados DENTRO da transação da operação que os originou.
import type { FormaPagamento, Prisma, TipoMovEstoque } from "@prisma/client";

type Tx = Prisma.TransactionClient;
type Item = { produtoId: string; quantidade: number };

export async function movimentarEstoqueLog(
  tx: Tx,
  itens: Item[],
  tipo: TipoMovEstoque,
  sinal: 1 | -1,
  extra: { pedidoId?: string; compraId?: string; motivo?: string; usuario?: string; custoUnitCents?: number | null } = {},
) {
  if (!itens.length) return;
  await tx.movimentoEstoque.createMany({
    data: itens.map((i) => ({
      produtoId: i.produtoId,
      tipo,
      quantidade: sinal * i.quantidade,
      pedidoId: extra.pedidoId,
      compraId: extra.compraId,
      motivo: extra.motivo,
      usuario: extra.usuario ?? "sistema",
      custoUnitCents: extra.custoUnitCents ?? undefined,
    })),
  });
}

export const contaDaForma = (f: FormaPagamento | null | undefined) =>
  f === "DINHEIRO" ? "Caixa da loja" : f === "PIX_ASAAS" ? "Asaas" : "Banco";

/** Receita já recebida (venda). */
export async function lancarReceitaVenda(
  tx: Tx,
  p: { pedidoId: string; numero: number; valorCents: number; forma: FormaPagamento; online: boolean; usuario?: string },
) {
  if (p.valorCents <= 0) return;
  const agora = new Date();
  await tx.lancamento.create({
    data: {
      tipo: "RECEITA",
      descricao: `${p.online ? "Venda online" : "Venda na loja"} — pedido #${p.numero}`,
      categoria: p.online ? "Vendas online" : "Vendas loja física",
      valorCents: p.valorCents,
      vencimento: agora,
      pagoEm: agora,
      status: "PAGO",
      forma: p.forma,
      conta: p.online ? "Asaas" : contaDaForma(p.forma),
      origem: p.online ? "VENDA_ONLINE" : "VENDA_PDV",
      pedidoId: p.pedidoId,
      usuario: p.usuario ?? "sistema",
    },
  });
}

/** Estorno devolvido ao cliente. */
export async function lancarEstorno(tx: Tx, p: { pedidoId: string; numero: number; valorCents: number; forma: FormaPagamento | null; online: boolean; usuario: string; motivo?: string }) {
  if (p.valorCents <= 0) return;
  const agora = new Date();
  await tx.lancamento.create({
    data: {
      tipo: "DESPESA",
      descricao: `Estorno — pedido #${p.numero}${p.motivo ? ` (${p.motivo})` : ""}`,
      categoria: "Estornos e devoluções",
      valorCents: p.valorCents,
      vencimento: agora,
      pagoEm: agora,
      status: "PAGO",
      forma: p.forma ?? undefined,
      conta: p.online ? "Asaas" : contaDaForma(p.forma),
      origem: "ESTORNO",
      pedidoId: p.pedidoId,
      usuario: p.usuario,
    },
  });
}
