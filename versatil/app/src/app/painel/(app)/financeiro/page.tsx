import Link from "next/link";
import type { Prisma, StatusLancamento, TipoLancamento } from "@prisma/client";
import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { FORMAS } from "@/lib/lojafisica";
import { deslocarMes, diaBR, inicioDoDiaBRT, intervaloMes, mesAtualBRT, nomeMes } from "@/lib/periodo";
import { AcoesLancamento, NovoLancamento } from "./FormsFinanceiro";

export const metadata = { title: "Financeiro" };
const STATUS_PAGOS = ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO", "ESTORNADO"] as const;

export default async function Financeiro({ searchParams }: PageProps<"/painel/financeiro">) {
  await exigirAdmin();
  const sp = await searchParams;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesAtualBRT();
  const aba = sp.aba === "resultado" ? "resultado" : "lancamentos";
  const tipo = (sp.tipo === "RECEITA" || sp.tipo === "DESPESA" ? sp.tipo : "") as TipoLancamento | "";
  const status = (sp.status === "PENDENTE" || sp.status === "PAGO" || sp.status === "CANCELADO" ? sp.status : "") as StatusLancamento | "";
  const { inicio, fim } = intervaloMes(mes);
  const hoje = inicioDoDiaBRT();
  const url = (o: Record<string, string>) => "/painel/financeiro?" + new URLSearchParams({ mes, aba, ...(tipo ? { tipo } : {}), ...(status ? { status } : {}), ...o }).toString();

  const noMes: Prisma.LancamentoWhereInput = { OR: [{ vencimento: { gte: inicio, lt: fim } }, { pagoEm: { gte: inicio, lt: fim } }] };
  const [pagosMes, pendentes, vencidas, lista] = await Promise.all([
    db.lancamento.groupBy({ by: ["tipo"], where: { status: "PAGO", pagoEm: { gte: inicio, lt: fim } }, _sum: { valorCents: true } }),
    db.lancamento.groupBy({ by: ["tipo"], where: { status: "PENDENTE" }, _sum: { valorCents: true }, _count: true }),
    db.lancamento.findMany({ where: { status: "PENDENTE", vencimento: { lt: hoje } }, orderBy: { vencimento: "asc" }, take: 20 }),
    db.lancamento.findMany({
      where: { AND: [noMes, ...(tipo ? [{ tipo }] : []), ...(status ? [{ status }] : [])] },
      orderBy: [{ vencimento: "desc" }, { criadoEm: "desc" }],
      take: 400,
    }),
  ]);
  const soma = (arr: { tipo: string; _sum: { valorCents: number | null } }[], t: string) => arr.find((x) => x.tipo === t)?._sum.valorCents ?? 0;
  const recebido = soma(pagosMes, "RECEITA");
  const pago = soma(pagosMes, "DESPESA");
  const aReceber = soma(pendentes, "RECEITA");
  const aPagar = soma(pendentes, "DESPESA");
  const categorias = [...new Set((await db.lancamento.findMany({ select: { categoria: true }, distinct: ["categoria"], take: 100 })).map((c) => c.categoria))];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Financeiro</h1>
        <div className="flex items-center gap-2 rounded-full border filete bg-white p-1 text-sm">
          <Link href={url({ mes: deslocarMes(mes, -1) })} className="rounded-full px-3 py-1 hover:bg-grafite">‹</Link>
          <span className="min-w-36 text-center font-semibold capitalize">{nomeMes(mes)}</span>
          <Link href={url({ mes: deslocarMes(mes, 1) })} className="rounded-full px-3 py-1 hover:bg-grafite">›</Link>
        </div>
      </div>

      <nav className="mt-4 flex gap-2">
        {[["lancamentos", "Contas e lançamentos"], ["resultado", "Resultado do mês (DRE)"]].map(([k, v]) => (
          <Link key={k} href={url({ aba: k })} className={`rounded-full border px-4 py-2 text-xs font-semibold ${aba === k ? "border-ouro bg-ouro/10 text-ouro-escuro" : "filete bg-white text-cinza"}`}>{v}</Link>
        ))}
      </nav>

      {aba === "resultado" ? (
        <Resultado inicio={inicio} fim={fim} />
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Recebido no mês", brl(recebido), "text-jade"],
              ["Pago no mês", brl(pago), "text-rubi"],
              ["Saldo do mês", brl(recebido - pago), recebido - pago >= 0 ? "text-jade" : "text-rubi"],
              ["A receber", brl(aReceber), ""],
              ["A pagar", brl(aPagar), vencidas.some((v) => v.tipo === "DESPESA") ? "text-rubi" : ""],
            ].map(([t, v, c]) => (
              <div key={t} className="rounded-2xl border filete bg-white p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cinza">{t}</p>
                <p className={`mt-1 text-xl font-extrabold ${c}`}>{v}</p>
              </div>
            ))}
          </div>

          {vencidas.length > 0 && (
            <div className="mt-4 rounded-2xl border border-rubi/40 bg-rubi/5 p-4">
              <p className="mb-2 font-bold text-rubi">⚠ {vencidas.length} conta(s) vencida(s)</p>
              <ul className="space-y-1.5">
                {vencidas.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                    <span className="min-w-0"><b>{l.descricao}</b><span className="block text-xs text-cinza">venceu {diaBR(l.vencimento)} · {l.categoria}</span></span>
                    <span className="flex shrink-0 items-center gap-3">
                      <b className={l.tipo === "DESPESA" ? "text-rubi" : "text-jade"}>{brl(l.valorCents)}</b>
                      <AcoesLancamento id={l.id} status={l.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
            <section>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                {[["", "Tudo"], ["RECEITA", "Receitas"], ["DESPESA", "Despesas"]].map(([k, v]) => (
                  <Link key={k} href={url({ tipo: k })} className={`rounded-full border px-3 py-1.5 font-semibold ${tipo === k ? "border-ouro bg-ouro/10 text-ouro-escuro" : "filete bg-white text-cinza"}`}>{v}</Link>
                ))}
                <span className="mx-1 text-fio">|</span>
                {[["", "Todos"], ["PENDENTE", "Em aberto"], ["PAGO", "Pagos"], ["CANCELADO", "Cancelados"]].map(([k, v]) => (
                  <Link key={k} href={url({ status: k })} className={`rounded-full border px-3 py-1.5 font-semibold ${status === k ? "border-ouro bg-ouro/10 text-ouro-escuro" : "filete bg-white text-cinza"}`}>{v}</Link>
                ))}
              </div>
              <div className="overflow-x-auto rounded-2xl border filete bg-white">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-grafite text-left text-[11px] uppercase tracking-wider text-cinza">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2 text-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fio">
                    {lista.map((l) => (
                      <tr key={l.id} className={l.status === "CANCELADO" ? "opacity-50" : ""}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-cinza">{diaBR(l.pagoEm ?? l.vencimento)}</td>
                        <td className="px-3 py-2">
                          <span className="line-clamp-1">{l.descricao}</span>
                          <span className="text-[11px] text-cinza">{l.conta}{l.forma ? ` · ${FORMAS[l.forma]}` : ""}{l.origem !== "MANUAL" ? " · automático" : ""}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">{l.categoria}</td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right font-bold ${l.tipo === "DESPESA" ? "text-rubi" : "text-jade"}`}>{l.tipo === "DESPESA" ? "− " : "+ "}{brl(l.valorCents)}</td>
                        <td className="px-3 py-2 text-center"><AcoesLancamento id={l.id} status={l.status} /></td>
                      </tr>
                    ))}
                    {!lista.length && <tr><td colSpan={5} className="px-3 py-10 text-center text-cinza">Nenhum lançamento neste mês.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <aside>
              <NovoLancamento categorias={categorias} />
              <p className="mt-3 text-center text-[11px] text-cinza">Vendas (site e loja), estornos e compras de mercadoria entram aqui automaticamente.</p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Linha({ rotulo, valor, forte = false, neg = false, sub = false, extra }: { rotulo: string; valor: number; forte?: boolean; neg?: boolean; sub?: boolean; extra?: string }) {
  return (
    <tr className={forte ? "bg-grafite font-bold" : ""}>
      <td className={`px-4 py-2.5 ${sub ? "pl-8 text-cinza" : ""}`}>{rotulo}</td>
      <td className={`px-4 py-2.5 text-right ${neg ? "text-rubi" : ""}`}>{neg && valor ? "− " : ""}{brl(valor)}</td>
      <td className="w-20 px-4 py-2.5 text-right text-xs text-cinza">{extra ?? ""}</td>
    </tr>
  );
}

/** DRE simplificada do mês: vendas − devoluções − custo das mercadorias − despesas. */
async function Resultado({ inicio, fim }: { inicio: Date; fim: Date }) {
  const [pedidos, estornos, despesas] = await Promise.all([
    db.pedido.findMany({
      where: { pagoEm: { gte: inicio, lt: fim }, status: { in: [...STATUS_PAGOS] } },
      select: { canal: true, totalCents: true, descontoCents: true, itens: { select: { quantidade: true, custoUnitCents: true, precoUnitCents: true } } },
    }),
    db.pedido.aggregate({ where: { estornadoEm: { gte: inicio, lt: fim } }, _sum: { estornoCents: true } }),
    db.lancamento.groupBy({
      by: ["categoria"],
      where: { tipo: "DESPESA", status: "PAGO", pagoEm: { gte: inicio, lt: fim }, categoria: { notIn: ["Compra de mercadoria", "Estornos e devoluções"] } },
      _sum: { valorCents: true },
      orderBy: { _sum: { valorCents: "desc" } },
    }),
  ]);
  const online = pedidos.filter((p) => p.canal === "ONLINE").reduce((s, p) => s + p.totalCents, 0);
  const loja = pedidos.filter((p) => p.canal === "PDV").reduce((s, p) => s + p.totalCents, 0);
  const bruta = online + loja;
  const devolucoes = estornos._sum.estornoCents ?? 0;
  const liquida = bruta - devolucoes;
  let cmv = 0;
  let semCusto = 0;
  for (const p of pedidos)
    for (const i of p.itens) {
      if (i.custoUnitCents != null) cmv += i.custoUnitCents * i.quantidade;
      else semCusto += i.precoUnitCents * i.quantidade;
    }
  const lucroBruto = liquida - cmv;
  const totalDesp = despesas.reduce((s, d) => s + (d._sum.valorCents ?? 0), 0);
  const resultado = lucroBruto - totalDesp;
  const pct = (v: number) => (liquida ? `${Math.round((v / liquida) * 100)}%` : "—");

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="overflow-hidden rounded-2xl border filete bg-white">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-fio">
            <Linha rotulo="Vendas (receita bruta)" valor={bruta} forte />
            <Linha rotulo="Loja online" valor={online} sub />
            <Linha rotulo="Loja física (balcão)" valor={loja} sub />
            <Linha rotulo="Devoluções e estornos" valor={devolucoes} neg />
            <Linha rotulo="Receita líquida" valor={liquida} forte />
            <Linha rotulo="Custo das mercadorias vendidas" valor={cmv} neg extra={pct(cmv)} />
            <Linha rotulo="Lucro bruto" valor={lucroBruto} forte extra={pct(lucroBruto)} />
            {despesas.map((d) => (
              <Linha key={d.categoria} rotulo={d.categoria} valor={d._sum.valorCents ?? 0} neg sub />
            ))}
            <Linha rotulo="Despesas do mês" valor={totalDesp} neg extra={pct(totalDesp)} />
            <tr className={`font-extrabold ${resultado >= 0 ? "bg-jade/10 text-jade" : "bg-rubi/10 text-rubi"}`}>
              <td className="px-4 py-3 text-base">Resultado do mês</td>
              <td className="px-4 py-3 text-right text-lg">{brl(resultado)}</td>
              <td className="px-4 py-3 text-right text-xs">{pct(resultado)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <aside className="space-y-3 text-sm">
        <div className="rounded-2xl border filete bg-white p-4">
          <p className="font-bold">Como ler</p>
          <p className="mt-1 text-xs text-cinza">
            Vendas pagas no mês (site + balcão), menos devoluções, menos o custo dos produtos que saíram (pelo custo de cada item no dia da venda), menos as despesas pagas no mês.
            Compras de mercadoria não entram como despesa aqui: elas viram estoque e só contam quando o produto é vendido.
          </p>
        </div>
        {semCusto > 0 && (
          <div className="rounded-2xl border border-ouro-escuro/50 bg-ouro/10 p-4 text-xs">
            <b>Atenção:</b> {brl(semCusto)} em vendas de produtos sem custo informado — o lucro fica maior do que o real. Informe o custo no cadastro ou lance as entradas de mercadoria em Compras.
          </div>
        )}
        <div className="rounded-2xl border filete bg-white p-4 text-xs text-cinza">{pedidos.length} venda(s) no período.</div>
      </aside>
    </div>
  );
}
