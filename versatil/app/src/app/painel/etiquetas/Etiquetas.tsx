"use client";
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { brl } from "@/lib/format";

type P = { id: string; codigo: number; titulo: string; precoCents: number; estoqueDisponivel: number };

/** Código que vai no código de barras: o leitor do PDV reconhece "V" + código interno. */
export const codigoBarras = (codigo: number) => `V${String(codigo).padStart(6, "0")}`;

function Barras({ valor }: { valor: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, valor, { format: "CODE128", width: 1.4, height: 34, displayValue: true, fontSize: 11, margin: 0 });
  }, [valor]);
  return <svg ref={ref} className="h-auto max-w-full" />;
}

export function Etiquetas({ produtos }: { produtos: P[] }) {
  const [formato, setFormato] = useState<"rolo" | "a4">("rolo");
  const [qtd, setQtd] = useState<Record<string, number>>(() => Object.fromEntries(produtos.map((p) => [p.id, Math.max(1, Math.min(p.estoqueDisponivel, 20))])));
  const lista = produtos.flatMap((p) => Array.from({ length: qtd[p.id] || 0 }, (_, i) => ({ ...p, k: `${p.id}-${i}` })));

  return (
    <div className="min-h-dvh bg-[#e5e5e5] print:bg-white">
      <style>{formato === "rolo" ? "@page { size: 50mm 30mm; margin: 0; }" : "@page { size: A4; margin: 8mm; }"}</style>
      <div className="mx-auto max-w-4xl p-4 print:hidden">
        <div className="rounded-2xl bg-white p-4">
          <h1 className="text-xl font-extrabold">Etiquetas com código de barras</h1>
          <p className="text-sm text-cinza">O leitor do PDV lê o código da etiqueta e adiciona o produto na venda.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["rolo", "a4"] as const).map((f) => (
              <button key={f} onClick={() => setFormato(f)} className={`rounded-full border px-4 py-2 text-xs font-semibold ${formato === f ? "border-ouro bg-ouro/10 text-ouro-escuro" : "filete"}`}>
                {f === "rolo" ? "Impressora de etiqueta (50×30 mm)" : "Folha A4 (3 colunas)"}
              </button>
            ))}
            <button onClick={() => window.print()} className="botao-ouro ml-auto px-6 py-2.5 text-sm">Imprimir {lista.length} etiqueta(s)</button>
          </div>
          <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border filete">
            {produtos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b filete px-3 py-1.5 text-sm last:border-0">
                <span className="line-clamp-1">{p.titulo}</span>
                <input type="number" min={0} max={200} value={qtd[p.id] ?? 0} onChange={(e) => setQtd({ ...qtd, [p.id]: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })} className="w-16 rounded-lg border filete px-2 py-1 text-center" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={formato === "a4" ? "mx-auto grid max-w-[190mm] grid-cols-3 gap-[2mm] print:max-w-none" : "flex flex-wrap justify-center gap-2 print:block print:gap-0"}>
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
