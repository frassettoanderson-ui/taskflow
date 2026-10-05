"use client";
import { useActionState, useTransition } from "react";
import { alternarCodigoAcao, criarCodigoAcao } from "../../codigos-acoes";

type Codigo = { id: string; nome: string; final: string; ativo: boolean; ultimoUso: string | null };

/** Códigos de acesso do cadastro rápido no celular (um por pessoa). */
export function CodigosCadastro({ codigos }: { codigos: Codigo[] }) {
  const [estado, acao, pend] = useActionState(criarCodigoAcao, undefined);
  const [alt, iniciar] = useTransition();
  return (
    <section className="mt-8 rounded-2xl border filete bg-white p-5">
      <h2 className="text-center text-lg font-extrabold">Códigos do cadastro rápido (celular)</h2>
      <p className="mt-1 text-center text-xs text-cinza">
        Quem recebe a mercadoria abre <b>/recebimento</b> (ou cadastro.seudominio quando o site estiver no ar) e entra com o código. Um código por pessoa — cancele quando alguém sair.
      </p>
      <form action={acao} className="mx-auto mt-4 flex max-w-sm gap-2">
        <input name="nome" placeholder="Nome de quem vai usar" className="campo !py-2" />
        <button disabled={pend} className="botao-ouro shrink-0 rounded-xl px-4 text-sm">{pend ? "…" : "Gerar código"}</button>
      </form>
      {estado?.erro && <p className="mt-2 text-center text-xs text-rubi">{estado.erro}</p>}
      {estado?.codigo && (
        <div className="mx-auto mt-3 max-w-sm rounded-xl border-2 border-ouro bg-ouro/10 p-3 text-center">
          <p className="text-xs">Código de <b>{estado.nome}</b> — anote agora, ele não aparece de novo:</p>
          <p className="mt-1 font-mono text-3xl font-extrabold tracking-[0.2em]">{estado.codigo.replace(/^(\d{4})/, "$1 ")}</p>
        </div>
      )}
      <ul className="mt-4 divide-y divide-fio">
        {codigos.map((c) => (
          <li key={c.id} className={`flex items-center justify-between gap-3 py-2 text-sm ${c.ativo ? "" : "opacity-50"}`}>
            <span>
              <b>{c.nome}</b> <span className="font-mono text-xs text-cinza">•••• ••{c.final}</span>
              <span className="block text-[11px] text-cinza">{c.ultimoUso ? `último uso ${c.ultimoUso}` : "ainda não usado"}</span>
            </span>
            <button disabled={alt} onClick={() => iniciar(async () => { await alternarCodigoAcao(c.id, !c.ativo); })} className={`text-xs font-semibold ${c.ativo ? "text-rubi" : "text-jade"}`}>
              {c.ativo ? "Cancelar" : "Reativar"}
            </button>
          </li>
        ))}
        {!codigos.length && <li className="py-3 text-center text-xs text-cinza">Nenhum código ainda.</li>}
      </ul>
    </section>
  );
}
