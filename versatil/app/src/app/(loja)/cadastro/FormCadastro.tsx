"use client";
import { useActionState, useState } from "react";
import { cadastrar } from "../conta/acoes";
import { mascaraCpf, mascaraTelefone } from "@/lib/format";
import { MARCA } from "@/lib/marca";

export function FormCadastro({ voltar }: { voltar: string }) {
  const [estado, acao, enviando] = useActionState(cadastrar, undefined);
  const [tel, setTel] = useState("");
  const [cpf, setCpf] = useState("");
  const rot = "block text-[13px] text-marfim/80";
  return (
    <form action={acao} className="mt-6 space-y-3">
      <input type="hidden" name="voltar" value={voltar} />
      <label className={rot}>
        Nome completo
        <input name="nome" required autoComplete="name" className="campo mt-1" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={rot}>
          WhatsApp
          <input name="telefone" required inputMode="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(mascaraTelefone(e.target.value))} className="campo mt-1" />
        </label>
        <label className={rot}>
          CPF
          <input name="cpf" required inputMode="numeric" value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} className="campo mt-1" />
        </label>
      </div>
      <label className={rot}>
        E-mail
        <input name="email" type="email" required autoComplete="email" className="campo mt-1" />
      </label>
      <label className={rot}>
        Senha (mínimo 6 caracteres)
        <input name="senha" type="password" required minLength={6} autoComplete="new-password" className="campo mt-1" />
      </label>
      {estado?.erro && <p className="text-[13px] text-rubi">{estado.erro}</p>}
      <button disabled={enviando} className="botao-principal h-12 w-full text-[15px]">{enviando ? "Criando conta…" : "Criar conta"}</button>
      <p className="text-center text-[11px] text-cinza">Usamos seus dados só para seus pedidos na {MARCA.nome}.</p>
    </form>
  );
}
