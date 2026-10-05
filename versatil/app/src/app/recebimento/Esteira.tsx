"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { esteiraAcao } from "./acoes";
import { brl } from "@/lib/format";
import { urlFoto } from "@/lib/uploads-url";

type Item = Awaited<ReturnType<typeof esteiraAcao>>[number];

const SELO: Record<string, [string, string]> = {
  PROCESSANDO: ["Identificando…", "bg-ouro/15 text-ouro-escuro animate-pulse"],
  PRONTO: ["Pronto para conferir", "bg-jade/10 text-jade"],
  ERRO: ["Não deu certo — abrir", "bg-rubi/10 text-rubi"],
};

/** Produtos fotografados aguardando conferência; atualiza sozinho enquanto a IA trabalha. */
export function Esteira({ inicial }: { inicial: Item[] }) {
  const [itens, setItens] = useState(inicial);
  const processando = itens.some((i) => i.status === "PROCESSANDO");
  useEffect(() => {
    if (!processando) return;
    const t = setInterval(async () => setItens(await esteiraAcao()), 3500);
    return () => clearInterval(t);
  }, [processando]);

  if (!itens.length) return <p className="mt-10 px-6 text-center text-sm text-cinza">Nada na fila. Os produtos fotografados aparecem aqui enquanto são identificados.</p>;
  return (
    <section className="mt-6 px-4">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-cinza">Fila para conferir ({itens.length})</p>
      <ul className="space-y-2">
        {itens.map((i) => {
          const [rotulo, cor] = SELO[i.status] ?? ["", ""];
          const conteudo = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlFoto(i.foto, true)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 text-left">
                <p className="line-clamp-2 text-sm font-semibold">{i.titulo || (i.status === "PROCESSANDO" ? "Produto novo" : "Sem nome — toque para completar")}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${cor}`}>{rotulo}</span>
                {i.sugeridoCents != null && <span className="ml-2 text-sm font-bold text-ouro-escuro">{brl(i.sugeridoCents)}</span>}
              </div>
            </>
          );
          return (
            <li key={i.id}>
              {i.status === "PROCESSANDO" ? (
                <div className="flex items-center gap-3 rounded-2xl border filete bg-white p-2.5 opacity-80">{conteudo}</div>
              ) : (
                <Link href={`/recebimento/${i.id}`} className="flex items-center gap-3 rounded-2xl border filete bg-white p-2.5 active:scale-[0.99]">
                  {conteudo}
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-cinza" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
