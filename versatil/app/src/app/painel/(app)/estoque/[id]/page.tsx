import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { codigoInterno } from "@/components/CardProduto";
import { AcoesEstoque } from "../AcoesEstoque";

const TIPOS: Record<string, string> = {
  CADASTRO: "Cadastro",
  ENTRADA_COMPRA: "Entrada (compra)",
  AJUSTE: "Ajuste",
  PERDA: "Perda / avaria",
  VENDA_ONLINE: "Venda online",
  VENDA_PDV: "Venda na loja",
  ESTORNO: "Devolução ao estoque",
};
const hora = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function HistoricoEstoque({ params }: PageProps<"/painel/estoque/[id]">) {
  await exigirAdmin();
  const { id } = await params;
  const p = await db.produto.findUnique({ where: { id }, include: { movimentos: { orderBy: { criadoEm: "desc" }, take: 200 } } });
  if (!p) notFound();
  const pedidos = await db.pedido.findMany({ where: { id: { in: p.movimentos.map((m) => m.pedidoId).filter(Boolean) as string[] } }, select: { id: true, numero: true } });
  const num = new Map(pedidos.map((x) => [x.id, x.numero]));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/painel/estoque" className="text-xs text-cinza">← Estoque</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3 rounded-2xl border filete bg-white p-5">
        <div>
          <p className="text-xs text-cinza">{codigoInterno(p.codigo)}</p>
          <h1 className="text-xl font-extrabold">{p.titulo}</h1>
          <p className="mt-1 text-sm">
            <b>{p.estoqueDisponivel}</b> disponível · {p.estoqueReservado} reservado · {p.vendidos} vendido(s) · custo {p.custoCents != null ? brl(p.custoCents) : "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <AcoesEstoque produtoId={p.id} titulo={p.titulo} minimo={p.estoqueMinimo} />
          <Link href={`/painel/produtos/${p.id}`} className="rounded-lg border filete px-3 py-1.5 text-xs font-semibold">Editar produto</Link>
        </div>
      </div>

      <h2 className="mb-2 mt-6 font-bold">Movimentações</h2>
      <ul className="space-y-1.5">
        {p.movimentos.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border filete bg-white px-4 py-2.5 text-sm">
            <span className="min-w-0">
              <b>{TIPOS[m.tipo]}</b>
              {m.pedidoId && num.has(m.pedidoId) && (
                <Link href={`/painel/pedidos/${m.pedidoId}`} className="ml-1 text-ouro-escuro underline underline-offset-2">pedido #{num.get(m.pedidoId)}</Link>
              )}
              {m.custoUnitCents != null && <span className="text-cinza"> · custo {brl(m.custoUnitCents)}</span>}
              {m.motivo && <span className="text-cinza"> · {m.motivo}</span>}
              <span className="block text-[11px] text-cinza">{hora(m.criadoEm)} · {m.usuario}</span>
            </span>
            <span className={`shrink-0 text-lg font-extrabold ${m.quantidade < 0 ? "text-rubi" : "text-jade"}`}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</span>
          </li>
        ))}
        {!p.movimentos.length && <li className="rounded-xl border filete bg-white p-6 text-center text-sm text-cinza">Sem movimentações registradas ainda.</li>}
      </ul>
    </div>
  );
}
