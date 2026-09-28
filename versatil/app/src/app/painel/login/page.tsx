"use client";
import { useActionState } from "react";
import { entrar } from "../acoes";

export default function Login() {
  const [estado, acao, enviando] = useActionState(entrar, undefined);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form action={acao} className="entrada w-full max-w-sm rounded-3xl border filete bg-white p-7 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-preto.svg" alt="Versátil" className="mx-auto h-12 w-auto" />
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.25em] text-ouro-escuro">Painel da loja</p>
        <div className="mt-5 space-y-3 text-left">
          <input name="email" type="email" required placeholder="E-mail" autoComplete="username" className="campo" />
          <input name="senha" type="password" required placeholder="Senha" autoComplete="current-password" className="campo" />
        </div>
        {estado?.erro && <p className="mt-3 text-sm text-rubi">{estado.erro}</p>}
        <button disabled={enviando} className="botao-ouro mt-5 w-full rounded-xl py-3.5">{enviando ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}
