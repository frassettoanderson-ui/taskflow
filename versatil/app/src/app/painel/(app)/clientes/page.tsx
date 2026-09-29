import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl, mascaraTelefone } from "@/lib/format";
import { diaBR } from "@/lib/periodo";

export const metadata = { title: "Clientes" };

export default async function Clientes({ searchParams }: PageProps<"/painel/clientes">) {
  await exigirAdmin();
  const q = typeof (await searchParams).q === "string" ? String((await searchParams).q).trim() : "";
  const clientes = await db.cliente.findMany({
    where: {
      telefone: { not: "00000000000" },
      ...(q ? { OR: [{ nome: { contains: q, mode: "insensitive" } }, { telefone: { contains: q.replace(/\D/g, "") || q } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: { id: true, nome: true, telefone: true, email: true, senhaHash: true, criadoEm: true },
    orderBy: { criadoEm: "desc" },
    take: 500,
  });
  const compras = await db.pedido.groupBy({
    by: ["clienteId"],
    where: { clienteId: { in: clientes.map((c) => c.id) }, status: { in: ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO"] } },
    _sum: { totalCents: true },
    _count: true,
    _max: { pagoEm: true },
  });
  const porCliente = new Map(compras.map((c) => [c.clienteId, c]));
  const lista = clientes
    .map((c) => ({ ...c, compras: porCliente.get(c.id)?._count ?? 0, gasto: porCliente.get(c.id)?._sum.totalCents ?? 0, ultima: porCliente.get(c.id)?._max.pagoEm ?? null }))
    .sort((a, b) => b.gasto - a.gasto);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Clientes <span className="text-base font-normal text-cinza">({lista.length})</span></h1>
        <form action="/painel/clientes" className="w-full sm:w-72">
          <input name="q" defaultValue={q} placeholder="Buscar nome, WhatsApp ou e-mail" className="campo !py-2" />
        </form>
      </div>
      <p className="mt-1 text-xs text-cinza">Quem comprou no site ou foi identificado no balcão. Ordenado por quem mais comprou.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border filete bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-grafite text-left text-[11px] uppercase tracking-wider text-cinza">
            <tr><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">WhatsApp</th><th className="px-3 py-2 text-center">Compras</th><th className="px-3 py-2 text-right">Total gasto</th><th className="px-3 py-2">Última compra</th></tr>
          </thead>
          <tbody className="divide-y divide-fio">
            {lista.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2">
                  <span className="font-semibold">{c.nome}</span>
                  {c.senhaHash && <span className="ml-2 rounded-full bg-jade/10 px-2 py-0.5 text-[10px] font-bold text-jade">tem conta</span>}
                  {c.email && <span className="block text-[11px] text-cinza">{c.email}</span>}
                </td>
                <td className="px-3 py-2">
                  <a href={`https://wa.me/55${c.telefone}`} target="_blank" className="text-ouro-escuro underline underline-offset-2">{mascaraTelefone(c.telefone)}</a>
                </td>
                <td className="px-3 py-2 text-center">{c.compras}</td>
                <td className="px-3 py-2 text-right font-bold">{brl(c.gasto)}</td>
                <td className="px-3 py-2 text-xs text-cinza">{c.ultima ? diaBR(c.ultima) : "—"}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={5} className="px-3 py-10 text-center text-cinza">Nenhum cliente ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
