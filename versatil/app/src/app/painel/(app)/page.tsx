import Link from "next/link";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { expirarPedidos } from "@/lib/pedidos";
import { modoDemo } from "@/lib/asaas";
import { brl, diasDesde, STATUS_PEDIDO } from "@/lib/format";

function inicioDoDiaBRT() {
  const agora = new Date(Date.now() - 3 * 3600_000);
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()) + 3 * 3600_000);
}

export default async function Inicio() {
  await expirarPedidos();
  const cfg = await getConfig();
  const hoje = inicioDoDiaBRT();
  const pagos = ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO"] as const;
  const vermelho = Number(cfg.parado_vermelho_dias);

  const [vendasHoje, aSeparar, reservas, ativos, fila] = await Promise.all([
    db.pedido.aggregate({ where: { pagoEm: { gte: hoje }, status: { in: [...pagos] } }, _sum: { totalCents: true }, _count: true }),
    db.pedido.count({ where: { status: { in: ["PAGO", "SEPARANDO"] } } }),
    db.pedido.count({ where: { status: "AGUARDANDO_PAGAMENTO" } }),
    db.produto.findMany({
      where: { status: "ATIVO" },
      select: { id: true, titulo: true, precoCents: true, estoqueDisponivel: true, publicadoEm: true, ultimaVendaEm: true, visualizacoes: true },
    }),
    db.pedido.findMany({
      where: { status: { in: ["PAGO", "SEPARANDO", "PRONTO"] } },
      include: { cliente: { select: { nome: true } }, itens: { select: { titulo: true, quantidade: true } } },
      orderBy: { pagoEm: "asc" },
      take: 6,
    }),
  ]);

  const comDias = ativos.map((p) => ({ ...p, dias: diasDesde(p.ultimaVendaEm ?? p.publicadoEm) })).sort((a, b) => b.dias - a.dias);
  const parados = comDias.filter((p) => p.dias >= vermelho);
  const valorVitrine = ativos.reduce((s, p) => s + p.precoCents * p.estoqueDisponivel, 0);

  const kpi = (rotulo: string, valor: string, sub?: string, destaque = false) => (
    <div className={`rounded-2xl border p-4 text-center ${destaque ? "border-ouro-escuro/70 bg-ouro/5" : "filete bg-carvao/60"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cinza">{rotulo}</p>
      <p className={`mt-1 text-2xl font-extrabold ${destaque ? "texto-ouro" : ""}`}>{valor}</p>
      {sub && <p className="text-xs text-cinza">{sub}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      {modoDemo() && (
        <p className="mb-4 rounded-xl border border-dashed border-ouro-escuro/60 px-4 py-2.5 text-center text-xs text-ouro-claro">
          Modo demonstração — pagamentos simulados. Configure a chave do Asaas no servidor para vender de verdade.
        </p>
      )}
      <h1 className="text-center text-2xl font-extrabold md:text-left">Resumo de hoje</h1>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpi("Vendido hoje", brl(vendasHoje._sum.totalCents || 0), `${vendasHoje._count} pedido(s)`, true)}
        {kpi("Para separar", String(aSeparar), "pagos aguardando")}
        {kpi("Pagando agora", String(reservas), "reservas ativas")}
        {kpi("Na vitrine", String(ativos.length), brl(valorVitrine))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-bold">Fila de separação</h2>
            <Link href="/painel/pedidos" className="text-xs text-ouro-claro">ver todos</Link>
          </div>
          {fila.length === 0 ? (
            <p className="rounded-2xl border filete p-6 text-center text-sm text-cinza">Nenhum pedido pendente.</p>
          ) : (
            <ul className="space-y-2">
              {fila.map((p) => (
                <li key={p.id}>
                  <Link href={`/painel/pedidos/${p.id}`} className="block rounded-xl border filete bg-carvao/60 p-3 text-center transition hover:border-ouro-escuro">
                    <p className="text-sm font-semibold">
                      <span className="font-mono text-ouro">#{p.numero}</span> · {p.cliente.nome.split(" ")[0]} · {brl(p.totalCents)}
                    </p>
                    <p className="line-clamp-1 text-xs text-cinza">{p.itens.map((i) => `${i.quantidade > 1 ? i.quantidade + "× " : ""}${i.titulo}`).join(", ")}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-ouro-claro">{STATUS_PEDIDO[p.status]}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-bold">
              Parados há {vermelho}+ dias <span className="font-mono text-rubi">({parados.length})</span>
            </h2>
            <Link href="/painel/produtos?ordem=parados" className="text-xs text-ouro-claro">ver todos</Link>
          </div>
          {parados.length === 0 ? (
            <p className="rounded-2xl border filete p-6 text-center text-sm text-cinza">Estoque girando bem. Nenhum produto parado.</p>
          ) : (
            <ul className="space-y-2">
              {parados.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/painel/produtos/${p.id}`} className="flex items-center justify-between gap-3 rounded-xl border filete bg-carvao/60 p-3 transition hover:border-ouro-escuro">
                    <span className="line-clamp-1 text-sm">{p.titulo}</span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm text-rubi">{p.dias}d</span>
                      <span className="block text-[10px] text-cinza">{p.visualizacoes} visitas</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 text-center md:hidden">
        <Link href="/painel/config" className="text-sm text-cinza underline underline-offset-4">Configurações da loja</Link>
      </div>
    </div>
  );
}
