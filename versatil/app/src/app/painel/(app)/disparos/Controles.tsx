"use client";
import { useActionState, useState, useTransition } from "react";
import { alternarFila, alternarGrupo, cancelarFilaProduto, enviarProximo, sincronizarGruposAcao } from "../../acoes";

export function ControlesFila({ ativo, pendentes }: { ativo: boolean; pendentes: number }) {
  const [pend, iniciar] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="flex w-full gap-2">
        <button
          disabled={pend}
          onClick={() => iniciar(async () => { await alternarFila(!ativo); })}
          className={`flex-1 rounded-xl py-3 text-sm font-bold ${ativo ? "border border-rubi/60 text-rubi" : "botao-ouro"}`}
        >
          {ativo ? "Pausar disparos" : "Retomar disparos"}
        </button>
        <button
          disabled={pend || !pendentes || !ativo}
          onClick={() => iniciar(async () => setMsg(await enviarProximo()))}
          className="flex-1 rounded-xl border border-ouro-escuro py-3 text-sm font-semibold text-ouro-escuro disabled:opacity-40"
        >
          Enviar próximo agora
        </button>
      </div>
      {msg && <p className="text-xs text-cinza">Resultado: {msg}</p>}
    </div>
  );
}

export function BotaoSincronizar() {
  const [estado, acao, pend] = useActionState(sincronizarGruposAcao, undefined);
  return (
    <form action={acao} className="text-center">
      <button disabled={pend} className="rounded-xl border border-ouro-escuro px-4 py-2 text-xs font-semibold text-ouro-escuro">
        {pend ? "Atualizando…" : "Atualizar grupos"}
      </button>
      {estado?.ok && <p className="mt-2 text-xs text-jade">{estado.ok}</p>}
      {estado?.erro && <p className="mt-2 text-xs text-rubi">{estado.erro}</p>}
    </form>
  );
}

export function ToggleGrupo({ id, ativo }: { id: string; ativo: boolean }) {
  const [pend, iniciar] = useTransition();
  return (
    <button
      disabled={pend}
      onClick={() => iniciar(async () => { await alternarGrupo(id, !ativo); })}
      aria-label={ativo ? "Desativar grupo" : "Ativar grupo"}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${ativo ? "bg-ouro" : "bg-fio"} ${pend ? "opacity-50" : ""}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-noite transition-all ${ativo ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function CancelarProduto({ produtoId }: { produtoId: string }) {
  const [pend, iniciar] = useTransition();
  return (
    <button disabled={pend} onClick={() => iniciar(async () => { await cancelarFilaProduto(produtoId); })} className="text-[11px] text-rubi underline underline-offset-2">
      tirar da fila
    </button>
  );
}
