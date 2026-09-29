import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { brl } from "@/lib/format";
import { FORMAS, resumoCaixa } from "@/lib/lojafisica";
import { db } from "@/lib/db";
import { BotaoImprimir } from "../../../cupom/[id]/BotaoImprimir";

const hora = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Relatório de fechamento de caixa (imprimível). */
export default async function RelatorioCaixa({ params }: PageProps<"/painel/caixa/[id]">) {
  await exigirUsuario();
  const { id } = await params;
  const existe = await db.caixaSessao.findUnique({ where: { id }, select: { id: true } });
  if (!existe) notFound();
  const r = await resumoCaixa(id);
  const cx = r.caixa;
  const contagem = (cx.contagem ?? {}) as Record<string, number>;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/painel/caixa" className="text-xs text-cinza print:hidden">← Caixa</Link>
      <div className="mt-2 rounded-2xl border filete bg-white p-6">
        <h1 className="text-center text-xl font-extrabold">Fechamento do caixa #{cx.numero}</h1>
        <p className="mt-1 text-center text-sm text-cinza">
          Aberto por {cx.abertoPor} em {hora(cx.abertoEm)}
          {cx.fechadoEm && <> · fechado por {cx.fechadoPor} em {hora(cx.fechadoEm)}</>}
        </p>
        <table className="mt-5 w-full text-sm">
          <tbody className="divide-y divide-fio">
            <tr><td className="py-2">Troco inicial</td><td className="py-2 text-right">{brl(cx.valorInicialCents)}</td></tr>
            {(["DINHEIRO", "PIX", "DEBITO", "CREDITO", "OUTRO"] as const).filter((f) => r.porForma[f]).map((f) => (
              <tr key={f}><td className="py-2">Vendas — {FORMAS[f]}</td><td className="py-2 text-right">{brl(r.porForma[f])}</td></tr>
            ))}
            {Object.entries(r.devolucoesPorForma).filter(([, v]) => v).map(([f, v]) => (
              <tr key={f}><td className="py-2">Devoluções — {FORMAS[f as keyof typeof FORMAS]}</td><td className="py-2 text-right text-rubi">− {brl(v)}</td></tr>
            ))}
            <tr><td className="py-2">Suprimentos</td><td className="py-2 text-right">{brl(r.suprimentos)}</td></tr>
            <tr><td className="py-2">Sangrias</td><td className="py-2 text-right text-rubi">− {brl(r.sangrias)}</td></tr>
            <tr className="font-bold"><td className="py-2">Total vendido ({r.qtdVendas} vendas)</td><td className="py-2 text-right">{brl(r.vendas)}</td></tr>
            <tr><td className="py-2">Dinheiro esperado na gaveta</td><td className="py-2 text-right">{brl(cx.esperadoCents ?? r.dinheiroEsperado)}</td></tr>
            <tr><td className="py-2">Dinheiro contado</td><td className="py-2 text-right">{cx.contadoCents != null ? brl(cx.contadoCents) : "—"}</td></tr>
            <tr className={`font-bold ${!cx.diferencaCents ? "text-jade" : "text-rubi"}`}>
              <td className="py-2">Diferença</td>
              <td className="py-2 text-right">{cx.diferencaCents == null ? "—" : cx.diferencaCents === 0 ? "confere ✓" : cx.diferencaCents > 0 ? `sobra ${brl(cx.diferencaCents)}` : `falta ${brl(-cx.diferencaCents)}`}</td>
            </tr>
            {Object.entries(contagem).filter(([f]) => f !== "DINHEIRO").map(([f, v]) => (
              <tr key={f}><td className="py-2 text-cinza">{FORMAS[f as keyof typeof FORMAS]} conferido</td><td className="py-2 text-right text-cinza">{brl(v)}</td></tr>
            ))}
          </tbody>
        </table>
        {cx.observacao && <p className="mt-4 rounded-lg bg-grafite p-3 text-sm">Obs.: {cx.observacao}</p>}
        <div className="mt-6 text-center print:hidden">
          <BotaoImprimir />
        </div>
      </div>
    </div>
  );
}
