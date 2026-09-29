"use client";
import { useActionState, useState, useTransition } from "react";
import { alternarUsuarioAcao, salvarUsuarioAcao } from "../../loja-acoes";

type U = { id: string; nome: string; email: string; papel: "ADMIN" | "OPERADOR" };

export function FormUsuario({ usuario }: { usuario?: U }) {
  const [estado, acao, pend] = useActionState(salvarUsuarioAcao, undefined);
  const [aberto, setAberto] = useState(!usuario);
  if (!aberto) return <button onClick={() => setAberto(true)} className="rounded-lg border filete px-3 py-1.5 text-xs font-semibold">Editar</button>;
  const form = (
    <form action={acao} className="space-y-2 rounded-2xl border filete bg-white p-4 text-left">
      <p className="text-center font-bold">{usuario ? "Editar usuário" : "Novo usuário"}</p>
      {usuario && <input type="hidden" name="id" value={usuario.id} />}
      <input name="nome" defaultValue={usuario?.nome} required placeholder="Nome" className="campo !py-2" />
      <input name="email" type="email" defaultValue={usuario?.email} required placeholder="E-mail (login)" className="campo !py-2" />
      <input name="senha" type="password" placeholder={usuario ? "Nova senha (deixe vazio para manter)" : "Senha (mín. 6)"} className="campo !py-2" autoComplete="new-password" />
      <select name="papel" defaultValue={usuario?.papel ?? "OPERADOR"} className="campo !py-2">
        <option value="OPERADOR">Operador de caixa</option>
        <option value="ADMIN">Administrador</option>
      </select>
      {estado?.erro && <p className="text-xs text-rubi">{estado.erro}</p>}
      {estado?.ok && <p className="text-xs text-jade">{estado.ok}</p>}
      <div className="flex gap-2">
        {usuario && <button type="button" onClick={() => setAberto(false)} className="flex-1 rounded-xl border filete py-2 text-sm">Fechar</button>}
        <button disabled={pend} className="botao-ouro flex-1 py-2 text-sm">{pend ? "…" : "Salvar"}</button>
      </div>
    </form>
  );
  if (!usuario) return form;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAberto(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">{form}</div>
    </div>
  );
}

export function ToggleUsuario({ id, ativo }: { id: string; ativo: boolean }) {
  const [pend, iniciar] = useTransition();
  return (
    <button disabled={pend} onClick={() => iniciar(async () => { await alternarUsuarioAcao(id, !ativo); })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${ativo ? "text-rubi" : "text-jade"}`}>
      {ativo ? "Desativar" : "Reativar"}
    </button>
  );
}
