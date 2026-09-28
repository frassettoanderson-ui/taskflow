import Link from "next/link";
import type { StatusPedido } from "@prisma/client";
import { db } from "@/lib/db";
import { expirarPedidos } from "@/lib/pedidos";
import { brl, STATUS_PEDIDO } from "@/lib/format";
import { AcoesRapidas } from "./AcoesRapidas";

const ABAS: { chave: string; rotulo: string; status: StatusPedido[] }[] = [
  { chave: "separar", rotulo: "A separar", status: ["PAGO", "SEPARANDO"] },
  { chave: "prontos", rotulo: "Prontos", status: ["PRONTO"] },
  { chave: "aguardando", rotulo: "Aguardando pgto", status: ["AGUARDANDO_PAGAMENTO"] },
  { chave: "retirados", rotulo: "Retirados", status: ["RETIRADO"] },
  { chave: "outros", rotulo: "Cancel./Estorn.", status: ["EXPIRADO", "CANCELADO", "ESTORNADO"] },
];

const fmtHora = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function Pedidos({ searchParams }: PageProps<"/painel/pedidos">) {
  await expirarPedidos();
  const sp = await searchParams;
  const aba = ABAS.find((a) => a.chave === sp.aba) ?? ABAS[0];
  const [pedidos, contagem] = await Promise.all([
    db.pedido.findMany({
      where: { status: { in: aba.status } },
      include: { cliente: { select: { nome: true, telefone: true } }, itens: { select: { titulo: true, quantidade: true } } },
      orderBy: aba.chave === "separar" || aba.chave === "prontos" ? { pagoEm: "asc" } : { criadoEm: "desc" },
      take: 200,
    }),
    db.pedido.groupBy({ by: ["status"], _count: true }),
  ]);
  const n = (a: (typeof ABAS)[number]) => contagem.filter((c) => a.status.includes(c.status)).reduce((s, c) => s + c._count, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-center text-2xl font-extrabold md:text-left">Pedidos</h1>
      <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {ABAS.map((a) => (
          <Link key={a.chave} href={`/painel/pedidos?aba=${a.chave}`} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${aba.chave === a.chave ? "border-ouro bg-ouro/10 text-ouro-claro" : "filete text-cinza"}`}>
            {a.rotulo} <span className="font-mono opacity-70">{n(a)}</span>
          </Link>
        ))}
      </nav>

      {pedidos.length === 0 ? (
        <p className="mt-12 text-center text-sm text-cinza">Nada por aqui.</p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {pedidos.map((p) => (
            <li key={p.id} className="rounded-2xl border filete bg-carvao/60 p-4 text-center">
              <Link href={`/painel/pedidos/${p.id}`} className="block">
                <p className="font-mono text-xs text-ouro">
                  #{p.numero} · {fmtHora(p.pagoEm ?? p.criadoEm)} · {p.metodo === "PIX" ? "Pix" : "Cartão"}
                  {p.canal === "PDV" && " · balcão"}
                </p>
                <p className="mt-1 font-semibold">{p.cliente.nome}</p>
                <p className="mt-1 line-clamp-2 text-sm text-marfim/80">{p.itens.map((i) => `${i.quantidade > 1 ? i.quantidade + "× " : ""}${i.titulo}`).join(" · ")}</p>
                <p className="texto-ouro mt-2 text-xl font-extrabold">{brl(p.totalCents)}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cinza">{STATUS_PEDIDO[p.status]}</p>
                {p.alerta && <p className="mt-2 rounded-lg bg-rubi/10 px-2 py-1 text-xs text-rubi">{p.alerta}</p>}
              </Link>
              <AcoesRapidas pedidoId={p.id} status={p.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
