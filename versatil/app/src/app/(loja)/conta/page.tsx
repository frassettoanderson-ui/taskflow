import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteAtual } from "@/lib/conta";
import { db } from "@/lib/db";
import { brl, mascaraTelefone, STATUS_PEDIDO } from "@/lib/format";
import { FotoProduto } from "@/components/FotoProduto";
import { sair } from "./acoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Minha conta", robots: { index: false } };

const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" });

export default async function Conta() {
  const c = await clienteAtual();
  if (!c) redirect("/entrar?voltar=/conta");
  const pedidos = await db.pedido.findMany({
    where: { clienteId: c.id, status: { notIn: ["EXPIRADO", "CANCELADO"] } },
    orderBy: { criadoEm: "desc" },
    include: { itens: { include: { produto: { select: { fotos: { select: { arquivo: true }, take: 1, orderBy: { ordem: "asc" } } } } } } },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-[900px] px-3 py-6 md:px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold">Olá, {c.nome.split(" ")[0]}!</h1>
          <p className="text-[13px] text-cinza">{c.email} · {mascaraTelefone(c.telefone)}</p>
        </div>
        <form action={sair}>
          <button className="text-[13px] text-ouro-escuro hover:underline">Sair da conta</button>
        </form>
      </div>

      <h2 className="mb-3 mt-6 text-[18px] font-semibold">Minhas compras</h2>
      {pedidos.length === 0 ? (
        <div className="cartao p-10 text-center">
          <p className="text-cinza">Você ainda não fez nenhuma compra.</p>
          <Link href="/busca" className="botao-principal mt-4 inline-block px-6 py-3">Ver produtos</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link href={`/pedido/${p.acessoToken}`} className="cartao flex items-center gap-4 p-4 transition hover:shadow-[0_8px_16px_rgba(0,0,0,0.12)]">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[4px] bg-white">
                  <FotoProduto arquivo={p.itens[0]?.produto.fotos[0]?.arquivo} alt="" miniatura className="h-full w-full !object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-semibold ${["PAGO", "SEPARANDO", "PRONTO"].includes(p.status) ? "text-jade" : "text-cinza"}`}>
                    {p.status === "PRONTO" ? "Pronto para retirada" : STATUS_PEDIDO[p.status]}
                  </p>
                  <p className="line-clamp-1 text-[14px]">{p.itens.map((i) => i.titulo).join(", ")}</p>
                  <p className="text-[12px] text-cinza">Pedido #{p.numero} · {fmt(p.criadoEm)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[16px]">{brl(p.totalCents)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
