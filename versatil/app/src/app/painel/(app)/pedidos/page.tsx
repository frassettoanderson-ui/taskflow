import Link from "next/link";
import type { StatusPedido } from "@prisma/client";
import { db } from "@/lib/db";
import { expirarPedidos } from "@/lib/pedidos";
import { brl, STATUS_PEDIDO } from "@/lib/format";
import { cookies } from "next/headers";
import { AcoesRapidas } from "./AcoesRapidas";
import { AlternarModo } from "../AlternarModo";

const METODO = { PIX: "Pix", CARTAO: "Cartão", DINHEIRO: "Dinheiro", DEBITO: "Débito", MISTO: "Misto" } as const;

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
  const pedido = sp.modo ?? (await cookies()).get("vs_pedidos_modo")?.value;
  const modo = pedido === "lista" ? "lista" : "cards";
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Pedidos</h1>
        <AlternarModo modo={modo} cookie="vs_pedidos_modo" href={{ cards: `/painel/pedidos?aba=${aba.chave}&modo=cards`, lista: `/painel/pedidos?aba=${aba.chave}&modo=lista` }} />
      </div>
      <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {ABAS.map((a) => (
          <Link key={a.chave} href={`/painel/pedidos?aba=${a.chave}&modo=${modo}`} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${aba.chave === a.chave ? "border-ouro bg-ouro/10 text-ouro-escuro" : "filete text-cinza"}`}>
            {a.rotulo} <span className="font-mono opacity-70">{n(a)}</span>
          </Link>
        ))}
      </nav>

      {pedidos.length === 0 ? (
        <p className="mt-12 text-center text-sm text-cinza">Nada por aqui.</p>
      ) : modo === "lista" ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border filete bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-grafite text-left text-[11px] uppercase tracking-wider text-cinza">
              <tr>
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Itens</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fio">
              {pedidos.map((p) => (
                <tr key={p.id} className="align-middle hover:bg-grafite/40">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/painel/pedidos/${p.id}`} className="font-bold text-ouro-escuro underline-offset-2 hover:underline">#{p.numero}</Link>
                    <span className="block text-[10px] text-cinza">{METODO[p.metodo]}{p.canal === "PDV" && " · balcão"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-cinza">{fmtHora(p.pagoEm ?? p.criadoEm)}</td>
                  <td className="px-3 py-2 font-semibold">{p.cliente.nome}</td>
                  <td className="max-w-[260px] px-3 py-2">
                    <span className="line-clamp-2 text-xs">{p.itens.map((i) => `${i.quantidade > 1 ? i.quantidade + "× " : ""}${i.titulo}`).join(" · ")}</span>
                    {p.alerta && <span className="mt-1 block text-[11px] text-rubi">{p.alerta}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-bold">{brl(p.totalCents)}</td>
                  <td className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-cinza">{STATUS_PEDIDO[p.status]}</td>
                  <td className="w-[250px] px-3 py-2"><AcoesRapidas pedidoId={p.id} status={p.status} compacto /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {pedidos.map((p) => (
            <li key={p.id} className="rounded-2xl border filete bg-white p-4 text-center">
              <Link href={`/painel/pedidos/${p.id}`} className="block">
                <p className="font-mono text-xs text-ouro-escuro">
                  #{p.numero} · {fmtHora(p.pagoEm ?? p.criadoEm)} · {METODO[p.metodo]}
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
