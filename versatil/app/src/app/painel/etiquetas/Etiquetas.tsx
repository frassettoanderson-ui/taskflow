"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { brl } from "@/lib/format";
import { urlFoto } from "@/lib/uploads-url";
import { marcarImpressasAcao } from "./acoes";

type P = {
  id: string;
  codigo: number;
  titulo: string;
  precoCents: number;
  estoque: number;
  foto: string | null;
  pendente: boolean;
  impressaEm: string | null;
  cadastradoPor: string | null;
  criadoEm: string;
};

/** Código que vai no código de barras: o leitor do PDV reconhece "V" + código interno. */
export const codigoBarras = (codigo: number) => `V${String(codigo).padStart(6, "0")}`;

function Barras({ valor }: { valor: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, valor, { format: "CODE128", width: 1.4, height: 34, displayValue: true, fontSize: 11, margin: 0 });
  }, [valor]);
  return <svg ref={ref} className="h-auto max-w-full" />;
}

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Etiquetas({ aba, abas, naFila, busca, produtos }: { aba: string; abas: Record<string, string>; naFila: number; busca: string; produtos: P[] }) {
  const router = useRouter();
  const [formato, setFormato] = useState<"rolo" | "a4">("rolo");
  const [qtd, setQtd] = useState<Record<string, string>>({}); // vazio = não imprime
  const [aviso, setAviso] = useState("");
  const [pend, iniciar] = useTransition();
  const n = (id: string) => Math.max(0, Math.min(500, Number(qtd[id]) || 0));
  const selecionados = produtos.filter((p) => n(p.id) > 0);
  const lista = selecionados.flatMap((p) => Array.from({ length: n(p.id) }, (_, i) => ({ ...p, k: `${p.id}-${i}` })));
  const ultimaImpressao = useRef<string[]>([]);

  useEffect(() => {
    const depois = () => {
      if (!ultimaImpressao.current.length) return;
      const ids = ultimaImpressao.current;
      ultimaImpressao.current = [];
      if (confirm("As etiquetas saíram certinho? Marcar esses produtos como impressos (saem da fila)?"))
        iniciar(async () => {
          await marcarImpressasAcao(ids);
          setQtd({});
          setAviso(`${ids.length} produto(s) marcado(s) como impressos.`);
          router.refresh();
        });
    };
    window.addEventListener("afterprint", depois);
    return () => window.removeEventListener("afterprint", depois);
  }, [router]);

  function imprimir() {
    ultimaImpressao.current = selecionados.map((p) => p.id);
    window.print();
  }

  return (
    <div className="min-h-dvh bg-[#ededed] print:bg-white">
      <style>{formato === "rolo" ? "@page { size: 50mm 30mm; margin: 0; }" : "@page { size: A4; margin: 8mm; }"}</style>
      <div className="mx-auto max-w-4xl p-4 pb-32 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/painel" className="text-sm text-cinza">← Painel</Link>
          <h1 className="text-xl font-extrabold">Etiquetas</h1>
          <span className="w-14" />
        </div>

        <nav className="mt-4 flex justify-center gap-1 rounded-full border filete bg-white p-1 text-xs font-semibold">
          {Object.entries(abas).map(([k, v]) => (
            <Link key={k} href={`/painel/etiquetas?aba=${k}`} className={`flex-1 rounded-full px-3 py-2 text-center ${aba === k ? "bg-noite text-ouro-claro" : "text-cinza"}`}>
              {v}{k === "fila" ? ` (${naFila})` : ""}
            </Link>
          ))}
        </nav>

        {aba === "busca" && (
          <form action="/painel/etiquetas" className="mt-3">
            <input name="q" defaultValue={busca} autoFocus placeholder="Nome, código (V000123), SKU ou código de barras" className="campo text-center" />
          </form>
        )}
        {aviso && <p className="mt-3 rounded-xl bg-jade/10 px-3 py-2 text-center text-sm text-jade">{aviso}</p>}

        <ul className="mt-4 space-y-2">
          {produtos.map((p) => (
            <li key={p.id} className={`flex items-center gap-3 rounded-2xl border bg-white p-2.5 ${n(p.id) ? "border-ouro" : "filete"}`}>
              {p.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlFoto(p.foto, true)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="h-14 w-14 shrink-0 rounded-xl bg-grafite" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold">{p.titulo}</p>
                <p className="text-xs text-cinza">
                  <b className="text-ouro-escuro">{brl(p.precoCents)}</b> · {codigoBarras(p.codigo)}
                  {aba === "impressas" && p.impressaEm ? ` · impressa ${dataHora(p.impressaEm)}` : p.cadastradoPor ? ` · por ${p.cadastradoPor}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <input
                  value={qtd[p.id] ?? ""}
                  onChange={(e) => setQtd({ ...qtd, [p.id]: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  inputMode="numeric"
                  placeholder="Qtd"
                  aria-label="Quantidade de etiquetas"
                  className="w-16 rounded-lg border filete px-2 py-1.5 text-center text-lg font-bold"
                />
                <button type="button" onClick={() => setQtd({ ...qtd, [p.id]: String(Math.max(1, p.estoque)) })} className="rounded-full bg-grafite px-2 py-0.5 text-[11px] font-semibold text-cinza">
                  Estoque: {p.estoque}
                </button>
              </div>
            </li>
          ))}
          {!produtos.length && (
            <li className="rounded-2xl border filete bg-white p-8 text-center text-sm text-cinza">
              {aba === "fila" ? "Nenhuma etiqueta pendente. Produtos novos entram aqui automaticamente." : aba === "busca" ? "Busque um produto para imprimir a etiqueta." : "Nada impresso ainda."}
            </li>
          )}
        </ul>
      </div>

      {/* barra de impressão */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t filete bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2">
          {(["rolo", "a4"] as const).map((f) => (
            <button key={f} onClick={() => setFormato(f)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${formato === f ? "border-ouro bg-ouro/10 text-ouro-escuro" : "filete text-cinza"}`}>
              {f === "rolo" ? "Etiqueta 50×30 mm" : "Folha A4"}
            </button>
          ))}
          <button onClick={imprimir} disabled={!lista.length || pend} className="botao-ouro rounded-xl px-6 py-3 text-sm disabled:opacity-40">
            {lista.length ? `Imprimir ${lista.length} etiqueta(s) de ${selecionados.length} produto(s)` : "Preencha a quantidade"}
          </button>
        </div>
      </div>

      <div className={formato === "a4" ? "mx-auto hidden max-w-[190mm] grid-cols-3 gap-[2mm] print:grid print:max-w-none" : "hidden print:block"}>
        {lista.map((p) => (
          <div key={p.k} className="flex h-[30mm] w-[50mm] flex-col items-center justify-between overflow-hidden bg-white px-[2mm] py-[1.5mm] text-black print:break-after-page" style={formato === "a4" ? { breakAfter: "auto", border: "0.2mm dashed #bbb" } : undefined}>
            <p className="line-clamp-2 w-full text-center text-[8.5pt] font-semibold leading-tight">{p.titulo}</p>
            <p className="text-[12pt] font-extrabold leading-none">{brl(p.precoCents)}</p>
            <Barras valor={codigoBarras(p.codigo)} />
          </div>
        ))}
      </div>
    </div>
  );
}
