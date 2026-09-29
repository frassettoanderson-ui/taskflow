"use client";
import { useActionState, useState } from "react";
import { estornar } from "../../../acoes";
import { brl, mascaraMoeda } from "@/lib/format";

const ROTULO: Record<string, string> = { DINHEIRO: "Dinheiro", PIX: "Pix", PIX_ASAAS: "Pix (Asaas)", DEBITO: "Estorno no débito", CREDITO: "Estorno no crédito", OUTRO: "Outro" };

export function FormEstorno({ pedidoId, restanteCents, retirado, pdv = false, formas = [] }: { pedidoId: string; restanteCents: number; retirado: boolean; pdv?: boolean; formas?: string[] }) {
  const [estado, acao, enviando] = useActionState(estornar, undefined);
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"total" | "parcial">("total");
  const [valor, setValor] = useState("");

  if (!aberto)
    return (
      <div className="mt-4 text-center">
        <button onClick={() => setAberto(true)} className="text-sm text-rubi underline underline-offset-4">Estornar pagamento…</button>
      </div>
    );

  return (
    <form
      action={acao}
      onSubmit={(e) => {
        const txt = tipo === "total" ? `Estornar ${brl(restanteCents)} para o cliente?` : `Estornar R$ ${valor} para o cliente?`;
        if (!confirm(txt)) e.preventDefault();
      }}
      className="mt-4 rounded-2xl border border-rubi/40 bg-rubi/5 p-4 text-center"
    >
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <input type="hidden" name="tipo" value={tipo} />
      <p className="font-semibold text-rubi">Estorno</p>
      <div className="mt-3 flex justify-center gap-2">
        {(["total", "parcial"] as const).map((t) => (
          <button type="button" key={t} onClick={() => setTipo(t)} className={`rounded-full border px-4 py-2 text-xs font-semibold ${tipo === t ? "border-rubi bg-rubi/10 text-rubi" : "filete text-cinza"}`}>
            {t === "total" ? `Total (${brl(restanteCents)})` : "Parcial"}
          </button>
        ))}
      </div>
      {tipo === "parcial" && (
        <input name="valor" value={valor} onChange={(e) => setValor(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="Valor a devolver" className="campo mt-3 text-center" />
      )}
      {tipo === "total" && (
        <label className="mt-3 flex items-center justify-center gap-2 text-sm">
          <input type="checkbox" name="devolver" defaultChecked={pdv || !retirado} className="h-4 w-4 accent-[#d4af55]" />
          Devolver itens ao estoque (voltam para a vitrine)
        </label>
      )}
      {pdv && (
        <label className="mt-3 block text-sm">
          Devolver ao cliente em
          <select name="forma" defaultValue={formas.includes("DINHEIRO") || !formas.length ? "DINHEIRO" : formas[0]} className="campo mt-1 !py-2 text-center">
            {[...new Set(["DINHEIRO", ...formas])].map((f) => <option key={f} value={f}>{ROTULO[f] ?? f}</option>)}
          </select>
        </label>
      )}
      <input name="motivo" placeholder="Motivo (opcional)" className="campo mt-3" />
      {estado?.erro && <p className="mt-2 text-sm text-rubi">{estado.erro}</p>}
      {estado?.ok && <p className="mt-2 text-sm text-jade">{estado.ok}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setAberto(false)} className="flex-1 rounded-xl border filete py-3 text-sm text-cinza">Voltar</button>
        <button disabled={enviando} className="flex-1 rounded-xl bg-rubi py-3 text-sm font-bold text-noite">{enviando ? "Estornando…" : "Confirmar estorno"}</button>
      </div>
      <p className="mt-2 text-[11px] text-cinza">{pdv ? "Devolução em dinheiro sai do caixa aberto. Estorno no cartão deve ser feito também na maquininha." : "O valor volta ao cliente pelo mesmo meio de pagamento (Pix ou cartão)."}</p>
    </form>
  );
}
