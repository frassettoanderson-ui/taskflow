import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { caixaAberto, FORMAS, resumoCaixa } from "@/lib/lojafisica";
import { AbrirCaixa, FecharCaixa, MovimentoCaixa } from "./FormsCaixa";

export const metadata = { title: "Caixa" };
const hora = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const TIPO: Record<string, string> = { VENDA: "Venda", SANGRIA: "Sangria", SUPRIMENTO: "Suprimento", ESTORNO: "Devolução" };

export default async function Caixa() {
  const u = await exigirUsuario();
  const [cx, historico] = await Promise.all([
    caixaAberto(),
    db.caixaSessao.findMany({ where: { status: "FECHADO" }, orderBy: { fechadoEm: "desc" }, take: 15 }),
  ]);
  const r = cx ? await resumoCaixa(cx.id) : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Caixa</h1>
        {cx && <Link href="/painel/pdv" className="botao-ouro px-5 py-2.5 text-sm">Ir para o PDV</Link>}
      </div>

      {!cx || !r ? (
        <div className="mx-auto mt-6 max-w-md">
          <p className="mb-4 text-center text-sm text-cinza">Nenhum caixa aberto.</p>
          <AbrirCaixa />
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-cinza">
            Caixa <b>#{cx.numero}</b> aberto por {cx.abertoPor} em {hora(cx.abertoEm)} · troco inicial {brl(cx.valorInicialCents)}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Vendas", brl(r.vendas), `${r.qtdVendas} venda(s)`],
              ["Dinheiro na gaveta", brl(r.dinheiroEsperado), "esperado agora"],
              ["Sangrias", brl(r.sangrias), `suprimentos ${brl(r.suprimentos)}`],
              ["Devoluções", brl(r.estornos), "em dinheiro"],
            ].map(([t, v, s]) => (
              <div key={t} className="rounded-2xl border filete bg-white p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cinza">{t}</p>
                <p className="mt-1 text-2xl font-extrabold">{v}</p>
                <p className="text-xs text-cinza">{s}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border filete bg-white p-4">
            <p className="mb-2 text-sm font-bold">Por forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(["DINHEIRO", "PIX", "DEBITO", "CREDITO"] as const).map((f) => (
                <div key={f} className="rounded-xl bg-grafite px-3 py-2">
                  <p className="text-xs text-cinza">{FORMAS[f]}</p>
                  <p className="font-bold">{brl(r.porForma[f] || 0)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MovimentoCaixa />
            <FecharCaixa esperadoDinheiro={r.dinheiroEsperado} porForma={r.porForma} />
          </div>

          <h2 className="mb-2 mt-6 font-bold">Movimentações deste caixa</h2>
          <ul className="space-y-1.5">
            {[...r.caixa.movimentos].reverse().map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border filete bg-white px-3 py-2 text-sm">
                <span className="min-w-0">
                  <b>{TIPO[m.tipo]}</b> · {FORMAS[m.forma]} · <span className="text-cinza">{m.descricao}</span>
                  <span className="block text-[11px] text-cinza">{hora(m.criadoEm)} · {m.usuario}</span>
                </span>
                <span className={`shrink-0 font-bold ${m.valorCents < 0 ? "text-rubi" : "text-jade"}`}>{brl(m.valorCents)}</span>
              </li>
            ))}
            {!r.caixa.movimentos.length && <li className="rounded-xl border filete bg-white p-4 text-center text-sm text-cinza">Nenhuma movimentação ainda.</li>}
          </ul>
        </>
      )}

      {u.papel === "ADMIN" && historico.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 font-bold">Caixas fechados</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {historico.map((h) => (
              <li key={h.id}>
                <Link href={`/painel/caixa/${h.id}`} className="flex items-center justify-between rounded-xl border filete bg-white px-4 py-3 text-sm hover:border-ouro-escuro">
                  <span>
                    <b>Caixa #{h.numero}</b>
                    <span className="block text-xs text-cinza">{hora(h.abertoEm)} → {h.fechadoEm ? hora(h.fechadoEm) : "—"} · {h.fechadoPor}</span>
                  </span>
                  <span className={`font-bold ${!h.diferencaCents ? "text-jade" : "text-rubi"}`}>
                    {!h.diferencaCents ? "✓ conferido" : h.diferencaCents > 0 ? `sobra ${brl(h.diferencaCents)}` : `falta ${brl(-h.diferencaCents)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
