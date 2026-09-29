"use client";
import { useActionState, useState } from "react";
import { abrirCaixaAcao, fecharCaixaAcao, movimentarCaixaAcao } from "../../loja-acoes";
import { brl, mascaraMoeda, parseReais } from "@/lib/format";

export function AbrirCaixa() {
  const [estado, acao, pend] = useActionState(abrirCaixaAcao, undefined);
  const [troco, setTroco] = useState("");
  return (
    <form action={acao} className="rounded-2xl border filete bg-white p-5 text-center">
      <label className="block text-xs font-semibold uppercase tracking-wider text-cinza">
        Troco inicial na gaveta
        <input name="troco" value={troco} onChange={(e) => setTroco(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="0,00" autoFocus className="campo mt-2 text-center text-3xl font-extrabold" />
      </label>
      {estado?.erro && <p className="mt-2 text-sm text-rubi">{estado.erro}</p>}
      <button disabled={pend} className="botao-ouro mt-4 w-full py-3.5 text-base">{pend ? "Abrindo…" : "Abrir caixa"}</button>
    </form>
  );
}

export function MovimentoCaixa() {
  const [estado, acao, pend] = useActionState(movimentarCaixaAcao, undefined);
  const [tipo, setTipo] = useState<"SANGRIA" | "SUPRIMENTO">("SANGRIA");
  const [valor, setValor] = useState("");
  return (
    <form action={(fd) => { acao(fd); setValor(""); }} className="rounded-2xl border filete bg-white p-4">
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-2 gap-2">
        {(["SANGRIA", "SUPRIMENTO"] as const).map((t) => (
          <button type="button" key={t} onClick={() => setTipo(t)} className={`rounded-xl py-2 text-sm font-bold ${tipo === t ? "bg-noite text-ouro-claro" : "bg-grafite text-cinza"}`}>
            {t === "SANGRIA" ? "Sangria (retirada)" : "Suprimento (troco)"}
          </button>
        ))}
      </div>
      <input name="valor" value={valor} onChange={(e) => setValor(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="Valor" className="campo mt-3 text-center text-lg font-bold" />
      <input name="descricao" placeholder={tipo === "SANGRIA" ? "Motivo (ex.: depósito no banco)" : "Motivo (ex.: reforço de troco)"} className="campo mt-2" />
      {estado?.erro && <p className="mt-2 text-center text-sm text-rubi">{estado.erro}</p>}
      {estado?.ok && <p className="mt-2 text-center text-sm text-jade">{estado.ok}</p>}
      <button disabled={pend} className="mt-3 w-full rounded-xl border-2 border-noite py-2.5 font-bold">{pend ? "Salvando…" : "Registrar"}</button>
    </form>
  );
}

export function FecharCaixa({ esperadoDinheiro, porForma }: { esperadoDinheiro: number; porForma: Record<string, number> }) {
  const [estado, acao, pend] = useActionState(fecharCaixaAcao, undefined);
  const [contado, setContado] = useState("");
  const dif = (parseReais(contado) ?? 0) - esperadoDinheiro;
  const outras = (["PIX", "DEBITO", "CREDITO"] as const).filter((f) => porForma[f]);
  return (
    <form
      action={acao}
      onSubmit={(e) => { if (!confirm("Fechar o caixa agora? Depois disso só será possível vender abrindo um novo.")) e.preventDefault(); }}
      className="rounded-2xl border-2 border-noite bg-white p-5"
    >
      <p className="text-center font-bold">Fechamento do caixa</p>
      <label className="mt-3 block text-center text-xs font-semibold uppercase tracking-wider text-cinza">
        Dinheiro contado na gaveta
        <input name="contagem_DINHEIRO" value={contado} onChange={(e) => setContado(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="0,00" className="campo mt-1 text-center text-2xl font-extrabold" />
      </label>
      <p className="mt-2 text-center text-sm">
        Esperado: <b>{brl(esperadoDinheiro)}</b>
        {contado && (
          <span className={`ml-2 font-bold ${dif === 0 ? "text-jade" : "text-rubi"}`}>
            {dif === 0 ? "✓ confere" : dif > 0 ? `sobra ${brl(dif)}` : `falta ${brl(-dif)}`}
          </span>
        )}
      </p>
      {outras.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {outras.map((f) => (
            <label key={f} className="text-center text-[11px] font-semibold uppercase text-cinza">
              {f === "PIX" ? "Pix" : f === "DEBITO" ? "Débito" : "Crédito"} (conferido)
              <input name={`contagem_${f}`} defaultValue={mascaraMoeda(String(porForma[f]))} inputMode="numeric" className="campo mt-1 text-center" />
            </label>
          ))}
        </div>
      )}
      <input name="observacao" placeholder="Observação (opcional)" className="campo mt-3" />
      {estado?.erro && <p className="mt-2 text-center text-sm text-rubi">{estado.erro}</p>}
      <button disabled={pend || !contado} className="botao-ouro mt-4 w-full py-3.5 disabled:opacity-40">{pend ? "Fechando…" : "Fechar caixa"}</button>
    </form>
  );
}
