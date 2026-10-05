"use client";
import { useActionState } from "react";
import { conectarMLAcao } from "../../preco-acoes";

/** Conexão com o Mercado Livre (pesquisa de preço) e situação da IA. */
export function ConexaoML({ configurado, conectado, urlAutorizacao, ia }: { configurado: boolean; conectado: boolean; urlAutorizacao: string; ia: boolean }) {
  const [estado, acao, pend] = useActionState(conectarMLAcao, undefined);
  const ok = conectado || !!estado?.ok;
  return (
    <section className="mt-8 rounded-2xl border filete bg-white p-5 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ouro-escuro">Pesquisa de preço</p>
      <p className="mt-2 text-sm">
        IA (reconhecer pela foto): <b className={ia ? "text-jade" : "text-rubi"}>{ia ? "ativa" : "falta a chave do Gemini no servidor"}</b>
      </p>
      <p className="mt-1 text-sm">
        Mercado Livre:{" "}
        <b className={ok ? "text-jade" : configurado ? "text-ouro-escuro" : "text-rubi"}>
          {ok ? "conectado" : configurado ? "aplicação cadastrada — falta autorizar" : "falta cadastrar a aplicação (modo simulação)"}
        </b>
      </p>
      {configurado && !ok && (
        <form action={acao} className="mt-4 space-y-2 text-left">
          <p className="text-center text-xs text-cinza">
            1. <a href={urlAutorizacao} target="_blank" className="font-semibold text-ouro-escuro underline underline-offset-2">Clique aqui e autorize</a> com a conta da loja no Mercado Livre.
            <br />2. Depois de autorizar, copie o endereço da página que abrir (tem <b>code=</b> nele) e cole abaixo.
          </p>
          <input name="codigo" placeholder="Cole aqui o endereço com code=…" className="campo !py-2 text-sm" />
          {estado?.erro && <p className="text-center text-xs text-rubi">{estado.erro}</p>}
          <button disabled={pend} className="botao-ouro w-full rounded-xl py-2.5 text-sm">{pend ? "Conectando…" : "Conectar Mercado Livre"}</button>
        </form>
      )}
      {estado?.ok && <p className="mt-2 text-xs text-jade">{estado.ok}</p>}
    </section>
  );
}
