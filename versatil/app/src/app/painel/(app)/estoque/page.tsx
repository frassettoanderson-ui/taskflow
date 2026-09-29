import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { FotoProduto } from "@/components/FotoProduto";
import { codigoInterno } from "@/components/CardProduto";
import { AcoesEstoque } from "./AcoesEstoque";

export const metadata = { title: "Estoque" };

const FILTROS = { todos: "Todos", baixo: "Repor", zerado: "Sem estoque" } as const;

export default async function Estoque({ searchParams }: PageProps<"/painel/estoque">) {
  await exigirAdmin();
  const sp = await searchParams;
  const filtro = (typeof sp.f === "string" && sp.f in FILTROS ? sp.f : "todos") as keyof typeof FILTROS;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where: Prisma.ProdutoWhereInput = {
    status: { in: ["ATIVO", "ESGOTADO", "RASCUNHO"] },
    ...(q ? { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { ean: q }, ...(Number(q) ? [{ codigo: Number(q) }] : [])] } : {}),
  };
  const todos = await db.produto.findMany({ where, include: { fotos: { take: 1, orderBy: { ordem: "asc" } } }, orderBy: { titulo: "asc" }, take: 1000 });
  const lista = todos.filter((p) =>
    filtro === "zerado" ? p.estoqueDisponivel + p.estoqueReservado === 0 : filtro === "baixo" ? p.estoqueMinimo > 0 && p.estoqueDisponivel <= p.estoqueMinimo : true,
  );
  const unidades = todos.reduce((s, p) => s + p.estoqueDisponivel + p.estoqueReservado, 0);
  const valorCusto = todos.reduce((s, p) => s + (p.custoCents ?? 0) * (p.estoqueDisponivel + p.estoqueReservado), 0);
  const valorVenda = todos.reduce((s, p) => s + p.precoCents * (p.estoqueDisponivel + p.estoqueReservado), 0);
  const repor = todos.filter((p) => p.estoqueMinimo > 0 && p.estoqueDisponivel <= p.estoqueMinimo).length;
  const semCusto = todos.filter((p) => p.custoCents == null && p.estoqueDisponivel > 0).length;
  const url = (o: Record<string, string>) => "/painel/estoque?" + new URLSearchParams({ f: filtro, ...(q ? { q } : {}), ...o }).toString();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Estoque</h1>
        <div className="flex gap-2">
          <Link href="/painel/compras/nova" className="botao-ouro px-4 py-2.5 text-sm">+ Entrada de mercadoria</Link>
          <Link href={`/painel/etiquetas?ids=${lista.slice(0, 60).map((p) => p.id).join(",")}`} className="rounded-xl border border-ouro-escuro px-4 py-2.5 text-sm font-semibold text-ouro-escuro">Etiquetas</Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Unidades em estoque", String(unidades), `${todos.length} produtos`],
          ["Valor de custo", brl(valorCusto), semCusto ? `${semCusto} sem custo informado` : "custo médio"],
          ["Valor de venda", brl(valorVenda), valorCusto ? `margem potencial ${brl(valorVenda - valorCusto)}` : ""],
          ["Para repor", String(repor), "abaixo do mínimo"],
        ].map(([t, v, s]) => (
          <div key={t} className="rounded-2xl border filete bg-white p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cinza">{t}</p>
            <p className="mt-1 text-xl font-extrabold">{v}</p>
            <p className="text-xs text-cinza">{s}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {Object.entries(FILTROS).map(([k, v]) => (
          <Link key={k} href={url({ f: k })} className={`rounded-full border px-4 py-2 text-xs font-semibold ${filtro === k ? "border-ouro bg-ouro/10 text-ouro-escuro" : "filete bg-white text-cinza"}`}>{v}</Link>
        ))}
        <form action="/painel/estoque" className="ml-auto w-full sm:w-72">
          <input type="hidden" name="f" value={filtro} />
          <input name="q" defaultValue={q} placeholder="Buscar nome, código, SKU, EAN" className="campo !py-2" />
        </form>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border filete bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-grafite text-left text-[11px] uppercase tracking-wider text-cinza">
            <tr>
              <th className="px-3 py-2.5">Produto</th>
              <th className="px-3 py-2.5 text-center">Disponível</th>
              <th className="px-3 py-2.5 text-center">Reservado</th>
              <th className="px-3 py-2.5 text-center">Mínimo</th>
              <th className="px-3 py-2.5 text-right">Custo</th>
              <th className="px-3 py-2.5 text-right">Preço</th>
              <th className="px-3 py-2.5 text-right">Margem</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fio">
            {lista.map((p) => {
              const alerta = p.estoqueMinimo > 0 && p.estoqueDisponivel <= p.estoqueMinimo;
              const margem = p.custoCents != null ? p.precoCents - p.custoCents : null;
              return (
                <tr key={p.id} className="hover:bg-grafite/50">
                  <td className="px-3 py-2">
                    <Link href={`/painel/estoque/${p.id}`} className="flex items-center gap-3">
                      <FotoProduto arquivo={p.fotos[0]?.arquivo} alt="" miniatura className="h-10 w-10 shrink-0 rounded-lg !object-contain" />
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-semibold">{p.titulo}</span>
                        <span className="text-[11px] text-cinza">{codigoInterno(p.codigo)}{p.sku ? ` · SKU ${p.sku}` : ""}{p.status !== "ATIVO" ? ` · ${p.status.toLowerCase()}` : ""}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={`px-3 py-2 text-center font-bold ${p.estoqueDisponivel === 0 ? "text-rubi" : alerta ? "text-ouro-escuro" : ""}`}>{p.estoqueDisponivel}{alerta && " ⚠"}</td>
                  <td className="px-3 py-2 text-center text-cinza">{p.estoqueReservado || "—"}</td>
                  <td className="px-3 py-2 text-center text-cinza">{p.estoqueMinimo || "—"}</td>
                  <td className="px-3 py-2 text-right">{p.custoCents != null ? brl(p.custoCents) : <span className="text-cinza">—</span>}</td>
                  <td className="px-3 py-2 text-right">{brl(p.precoCents)}</td>
                  <td className={`px-3 py-2 text-right ${margem != null && margem < 0 ? "text-rubi" : "text-jade"}`}>
                    {margem != null ? `${Math.round((margem / p.precoCents) * 100)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AcoesEstoque produtoId={p.id} titulo={p.titulo} minimo={p.estoqueMinimo} />
                  </td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-cinza">Nada por aqui.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
