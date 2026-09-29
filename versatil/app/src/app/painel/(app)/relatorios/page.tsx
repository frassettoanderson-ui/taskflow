import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { FORMAS } from "@/lib/lojafisica";
import { inicioDoDiaBRT } from "@/lib/periodo";

export const metadata = { title: "Relatórios" };
const PERIODOS = { "7": "7 dias", "30": "30 dias", "90": "90 dias", "365": "12 meses" } as const;
const STATUS_VENDA = ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO", "ESTORNADO"] as const;

function Barra({ rotulo, valor, max, extra, cor = "bg-ouro" }: { rotulo: string; valor: number; max: number; extra?: string; cor?: string }) {
  return (
    <div className="text-sm">
      <div className="flex justify-between gap-2">
        <span className="line-clamp-1">{rotulo}</span>
        <span className="shrink-0 font-semibold">{brl(valor)}{extra ? <span className="ml-1 text-xs font-normal text-cinza">{extra}</span> : null}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-grafite">
        <div className={`h-2 rounded-full ${cor}`} style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

export default async function Relatorios({ searchParams }: PageProps<"/painel/relatorios">) {
  await exigirAdmin();
  const sp = await searchParams;
  const dias = (typeof sp.dias === "string" && sp.dias in PERIODOS ? sp.dias : "30") as keyof typeof PERIODOS;
  const desde = inicioDoDiaBRT(Number(dias) - 1);

  const pedidos = await db.pedido.findMany({
    where: { pagoEm: { gte: desde }, status: { in: [...STATUS_VENDA] } },
    select: {
      id: true, canal: true, metodo: true, totalCents: true, estornoCents: true, pagoEm: true, operador: true,
      pagamentos: { select: { forma: true, valorCents: true } },
      itens: { select: { produtoId: true, titulo: true, quantidade: true, precoUnitCents: true, custoUnitCents: true } },
    },
  });
  const liquido = (p: (typeof pedidos)[number]) => p.totalCents - p.estornoCents;
  const total = pedidos.reduce((s, p) => s + liquido(p), 0);
  const qtd = pedidos.length;
  const ticket = qtd ? Math.round(total / qtd) : 0;
  const online = pedidos.filter((p) => p.canal === "ONLINE").reduce((s, p) => s + liquido(p), 0);
  const loja = total - online;
  const custo = pedidos.reduce((s, p) => s + p.itens.reduce((a, i) => a + (i.custoUnitCents ?? 0) * i.quantidade, 0), 0);
  const unidades = pedidos.reduce((s, p) => s + p.itens.reduce((a, i) => a + i.quantidade, 0), 0);

  // por forma de pagamento (balcão usa os pagamentos; online usa o método)
  const formas = new Map<string, number>();
  for (const p of pedidos) {
    if (p.canal === "PDV") for (const g of p.pagamentos) formas.set(FORMAS[g.forma], (formas.get(FORMAS[g.forma]) || 0) + g.valorCents);
    else {
      const k = p.metodo === "CARTAO" ? "Cartão (site)" : "Pix (site)";
      formas.set(k, (formas.get(k) || 0) + p.totalCents);
    }
  }
  // top produtos
  const prods = new Map<string, { titulo: string; qtd: number; receita: number; custo: number }>();
  for (const p of pedidos)
    for (const i of p.itens) {
      const x = prods.get(i.produtoId) ?? { titulo: i.titulo, qtd: 0, receita: 0, custo: 0 };
      x.qtd += i.quantidade;
      x.receita += i.precoUnitCents * i.quantidade;
      x.custo += (i.custoUnitCents ?? 0) * i.quantidade;
      prods.set(i.produtoId, x);
    }
  const top = [...prods.values()].sort((a, b) => b.receita - a.receita).slice(0, 10);
  // por dia
  const porDia = new Map<string, number>();
  for (let d = 0; d < Math.min(Number(dias), 31); d++) {
    const k = inicioDoDiaBRT(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
    porDia.set(k, 0);
  }
  for (const p of pedidos) {
    const k = p.pagoEm!.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
    if (porDia.has(k)) porDia.set(k, (porDia.get(k) || 0) + liquido(p));
  }
  const dias31 = [...porDia.entries()].reverse();
  const maxDia = Math.max(1, ...dias31.map(([, v]) => v));
  // operadores
  const ops = new Map<string, number>();
  for (const p of pedidos.filter((x) => x.canal === "PDV")) ops.set(p.operador ?? "—", (ops.get(p.operador ?? "—") || 0) + liquido(p));
  const maxForma = Math.max(1, ...formas.values());

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Relatórios de vendas</h1>
        <div className="flex gap-1 rounded-full border filete bg-white p-1 text-xs font-semibold">
          {Object.entries(PERIODOS).map(([k, v]) => (
            <Link key={k} href={`/painel/relatorios?dias=${k}`} className={`rounded-full px-3 py-1.5 ${dias === k ? "bg-noite text-ouro-claro" : "text-cinza"}`}>{v}</Link>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Vendido", brl(total)],
          ["Vendas", String(qtd)],
          ["Ticket médio", brl(ticket)],
          ["Unidades", String(unidades)],
          ["Lucro bruto", custo ? brl(total - custo) : "—"],
        ].map(([t, v]) => (
          <div key={t} className="rounded-2xl border filete bg-white p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cinza">{t}</p>
            <p className="mt-1 text-xl font-extrabold">{v}</p>
          </div>
        ))}
      </div>

      <section className="mt-5 rounded-2xl border filete bg-white p-4">
        <p className="mb-3 font-bold">Vendas por dia</p>
        <div className="flex h-40 items-end gap-1">
          {dias31.map(([d, v]) => (
            <div key={d} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d}: ${brl(v)}`}>
              <div className="rounded-t bg-ouro transition group-hover:bg-ouro-escuro" style={{ height: `${(v / maxDia) * 100}%`, minHeight: v ? 3 : 0 }} />
              <span className="mt-1 hidden text-center text-[9px] text-cinza md:block">{d.slice(0, 2)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="space-y-3 rounded-2xl border filete bg-white p-4">
          <p className="font-bold">Por canal</p>
          <Barra rotulo="Loja online" valor={online} max={Math.max(online, loja)} extra={total ? `${Math.round((online / total) * 100)}%` : ""} />
          <Barra rotulo="Loja física (balcão)" valor={loja} max={Math.max(online, loja)} extra={total ? `${Math.round((loja / total) * 100)}%` : ""} cor="bg-noite" />
          {ops.size > 0 && (
            <>
              <p className="pt-3 font-bold">Balcão por operador</p>
              {[...ops.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => <Barra key={n} rotulo={n} valor={v} max={Math.max(...ops.values())} cor="bg-jade" />)}
            </>
          )}
        </section>
        <section className="space-y-3 rounded-2xl border filete bg-white p-4">
          <p className="font-bold">Por forma de pagamento</p>
          {[...formas.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => <Barra key={n} rotulo={n} valor={v} max={maxForma} />)}
          {!formas.size && <p className="text-sm text-cinza">Sem vendas no período.</p>}
        </section>
      </div>

      <section className="mt-5 overflow-x-auto rounded-2xl border filete bg-white">
        <p className="px-4 pt-4 font-bold">Produtos que mais venderam</p>
        <table className="mt-2 w-full min-w-[560px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-cinza">
            <tr><th className="px-4 py-2">Produto</th><th className="px-4 py-2 text-center">Qtd</th><th className="px-4 py-2 text-right">Receita</th><th className="px-4 py-2 text-right">Lucro</th></tr>
          </thead>
          <tbody className="divide-y divide-fio">
            {top.map((t) => (
              <tr key={t.titulo}>
                <td className="px-4 py-2">{t.titulo}</td>
                <td className="px-4 py-2 text-center">{t.qtd}</td>
                <td className="px-4 py-2 text-right font-semibold">{brl(t.receita)}</td>
                <td className="px-4 py-2 text-right text-jade">{t.custo ? brl(t.receita - t.custo) : "—"}</td>
              </tr>
            ))}
            {!top.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-cinza">Sem vendas no período.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
