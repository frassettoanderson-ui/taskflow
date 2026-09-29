import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl, mascaraTelefone } from "@/lib/format";
import { FormFornecedor } from "./FormFornecedor";

export const metadata = { title: "Compras" };
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function Compras({ searchParams }: PageProps<"/painel/compras">) {
  await exigirAdmin();
  const ok = (await searchParams).ok;
  const [compras, fornecedores] = await Promise.all([
    db.compra.findMany({ orderBy: { data: "desc" }, take: 100, include: { fornecedor: true, itens: { include: { produto: { select: { titulo: true } } } } } }),
    db.fornecedor.findMany({ orderBy: { nome: "asc" }, include: { _count: { select: { compras: true } } } }),
  ]);
  const lancs = await db.lancamento.findMany({ where: { compraId: { in: compras.map((c) => c.id) } }, select: { compraId: true, status: true, vencimento: true } });
  const pagamento = new Map(lancs.map((l) => [l.compraId, l]));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Compras</h1>
        <Link href="/painel/compras/nova" className="botao-ouro px-5 py-2.5 text-sm">+ Nova entrada de mercadoria</Link>
      </div>
      {ok && <p className="mt-3 rounded-lg bg-jade/10 px-3 py-2 text-center text-sm text-jade">Compra #{ok} registrada: estoque e financeiro atualizados.</p>}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-2 font-bold">Últimas compras</h2>
          {!compras.length ? (
            <p className="rounded-2xl border filete bg-white p-8 text-center text-sm text-cinza">Nenhuma compra registrada. Use “Nova entrada de mercadoria” quando chegar um lote.</p>
          ) : (
            <ul className="space-y-2">
              {compras.map((c) => {
                const pg = pagamento.get(c.id);
                return (
                  <li key={c.id} className="rounded-2xl border filete bg-white p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">Compra #{c.numero} · {c.fornecedor?.nome ?? "Sem fornecedor"}</p>
                        <p className="text-xs text-cinza">{dia(c.data)}{c.notaFiscal ? ` · NF ${c.notaFiscal}` : ""} · {c.usuario}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold">{brl(c.totalCents)}</p>
                        {pg && (
                          <p className={`text-xs font-semibold ${pg.status === "PAGO" ? "text-jade" : "text-ouro-escuro"}`}>
                            {pg.status === "PAGO" ? "Paga" : `A pagar até ${dia(pg.vencimento)}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-marfim/80">{c.itens.map((i) => `${i.quantidade}× ${i.produto.titulo} (${brl(i.custoUnitCents)})`).join(" · ")}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-bold">Fornecedores</h2>
          <FormFornecedor />
          <ul className="mt-3 space-y-2">
            {fornecedores.map((f) => (
              <li key={f.id} className="rounded-xl border filete bg-white px-3 py-2 text-sm">
                <p className="font-semibold">{f.nome}</p>
                <p className="text-xs text-cinza">
                  {f.telefone ? mascaraTelefone(f.telefone) : "sem telefone"}
                  {f.documento ? ` · ${f.documento}` : ""} · {f._count.compras} compra(s)
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
