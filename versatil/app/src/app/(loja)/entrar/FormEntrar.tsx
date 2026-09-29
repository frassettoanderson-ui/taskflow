"use client";
import { useActionState } from "react";
import { entrar } from "../conta/acoes";

export function FormEntrar({ voltar }: { voltar: string }) {
  const [estado, acao, enviando] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="mt-6 space-y-3">
      <input type="hidden" name="voltar" value={voltar} />
      <label className="block text-[13px] text-marfim/80">
        E-mail ou WhatsApp
        <input name="login" required autoComplete="username" className="campo mt-1" />
      </label>
      <label className="block text-[13px] text-marfim/80">
        Senha
        <input name="senha" type="password" required autoComplete="current-password" className="campo mt-1" />
      </label>
      {estado?.erro && <p className="text-[13px] text-rubi">{estado.erro}</p>}
      <button disabled={enviando} className="botao-principal h-12 w-full text-[15px]">{enviando ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
