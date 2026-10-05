"use client";
import { useActionState, useState } from "react";
import { entrarAcao } from "../acoes";

/** Código de 8 números, mostrado como 0000 0000. */
const mascara = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{4})(\d)/, "$1 $2");

export function FormCodigo() {
  const [estado, acao, pend] = useActionState(entrarAcao, undefined);
  const [codigo, setCodigo] = useState("");
  return (
    <form action={acao} className="mt-8 w-full max-w-xs">
      <input
        name="codigo"
        value={codigo}
        onChange={(e) => setCodigo(mascara(e.target.value))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="0000 0000"
        className="campo text-center font-mono text-3xl tracking-[0.2em]"
      />
      {estado?.erro && <p className="mt-2 text-sm text-rubi">{estado.erro}</p>}
      <button disabled={pend || codigo.replace(/\D/g, "").length !== 8} className="botao-ouro mt-4 w-full rounded-xl py-4 text-base disabled:opacity-40">
        {pend ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
