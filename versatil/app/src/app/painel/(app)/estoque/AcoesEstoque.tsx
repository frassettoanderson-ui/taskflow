"use client";
import { useActionState, useState, useTransition } from "react";
import { ajustarEstoqueAcao, salvarMinimoAcao } from "../../loja-acoes";

export function AcoesEstoque({ produtoId, titulo, minimo }: { produtoId: string; titulo: string; minimo: number }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pend] = useActionState(ajustarEstoqueAcao, undefined);
  const [tipo, setTipo] = useState<"AJUSTE" | "PERDA">("AJUSTE");
  const [direcao, setDirecao] = useState<"mais" | "menos">("mais");
  const [min, setMin] = useState(String(minimo));
  const [salvando, iniciar] = useTransition();

  return (
    <>
      <button onClick={() => setAberto(true)} className="rounded-lg border filete px-3 py-1.5 text-xs font-semibold">Ajustar</button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-left" onClick={() => setAberto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="font-bold">{titulo}</p>
            <form action={acao} className="mt-4 space-y-3">
              <input type="hidden" name="produtoId" value={produtoId} />
              <input type="hidden" name="tipo" value={tipo} />
              <input type="hidden" name="direcao" value={direcao} />
              <div className="grid grid-cols-2 gap-2">
                {(["AJUSTE", "PERDA"] as const).map((t) => (
                  <button type="button" key={t} onClick={() => { setTipo(t); if (t === "PERDA") setDirecao("menos"); }} className={`rounded-xl py-2 text-sm font-bold ${tipo === t ? "bg-noite text-ouro-claro" : "bg-grafite text-cinza"}`}>
                    {t === "AJUSTE" ? "Ajuste de contagem" : "Perda / avaria"}
                  </button>
                ))}
              </div>
              {tipo === "AJUSTE" && (
                <div className="grid grid-cols-2 gap-2">
                  {(["mais", "menos"] as const).map((d) => (
                    <button type="button" key={d} onClick={() => setDirecao(d)} className={`rounded-xl border-2 py-2 text-sm font-bold ${direcao === d ? "border-ouro-escuro" : "filete text-cinza"}`}>
                      {d === "mais" ? "+ Somar" : "− Tirar"}
                    </button>
                  ))}
                </div>
              )}
              <input name="quantidade" type="number" min={1} required placeholder="Quantidade" className="campo text-center text-lg font-bold" />
              <input name="motivo" placeholder={tipo === "PERDA" ? "O que aconteceu? (ex.: caiu, quebrou)" : "Motivo (ex.: inventário)"} className="campo" />
              {estado?.erro && <p className="text-sm text-rubi">{estado.erro}</p>}
              {estado?.ok && <p className="text-sm text-jade">{estado.ok}</p>}
              <button disabled={pend} className="botao-ouro w-full py-3">{pend ? "Salvando…" : "Confirmar"}</button>
            </form>
            <div className="mt-4 flex items-center gap-2 border-t filete pt-4 text-sm">
              <span className="text-cinza">Estoque mínimo (alerta):</span>
              <input value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className="w-16 rounded-lg border filete px-2 py-1 text-center" />
              <button disabled={salvando} onClick={() => iniciar(async () => { await salvarMinimoAcao(produtoId, Number(min)); })} className="rounded-lg border filete px-3 py-1 text-xs font-semibold">
                {salvando ? "…" : "Salvar"}
              </button>
            </div>
            <button onClick={() => setAberto(false)} className="mt-3 w-full text-xs text-cinza">Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}
