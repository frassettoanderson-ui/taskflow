"use client";
import { useState, useTransition } from "react";
import { pesquisarPrecoAcao, type RespostaPreco } from "../../preco-acoes";
import type { Identificacao, ResultadoPreco } from "@/lib/precoMercado";
import { brl } from "@/lib/format";

/** Bloco "Preço de mercado": identifica pela foto (IA) e pesquisa no Mercado Livre. */
export function PesquisaPreco({
  arquivos,
  fotosSalvas,
  onIdentificar,
  onAplicar,
}: {
  arquivos: File[];
  fotosSalvas: string[];
  onIdentificar: (i: Identificacao) => void;
  onAplicar: (p: ResultadoPreco) => void;
}) {
  const [pend, iniciar] = useTransition();
  const [resp, setResp] = useState<RespostaPreco | null>(null);
  const [consulta, setConsulta] = useState("");
  const temFoto = arquivos.length + fotosSalvas.length > 0;

  function pesquisar(porTexto: boolean) {
    const fd = new FormData();
    if (porTexto) fd.set("consulta", consulta);
    else {
      arquivos.slice(0, 3).forEach((f) => fd.append("img", f));
      fotosSalvas.slice(0, 3).forEach((f) => fd.append("foto", f));
    }
    iniciar(async () => {
      const r = await pesquisarPrecoAcao(fd);
      setResp(r);
      if (r.ident) {
        onIdentificar(r.ident);
        setConsulta(r.ident.consulta);
      }
      if (r.preco) onAplicar(r.preco);
    });
  }

  const p = resp?.preco;
  return (
    <section className="rounded-2xl border border-ouro/60 bg-ouro/5 p-4 text-center">
      <p className="text-sm font-bold">Preço de mercado automático</p>
      <p className="mt-0.5 text-xs text-cinza">A IA reconhece o produto pela foto, busca anúncios novos no Mercado Livre e sugere o preço.</p>
      <button type="button" disabled={pend || !temFoto} onClick={() => pesquisar(false)} className="botao-ouro mt-3 w-full rounded-xl py-3 text-sm disabled:opacity-40">
        {pend ? "Pesquisando…" : temFoto ? "Identificar pela foto e buscar preço" : "Adicione uma foto para identificar"}
      </button>
      <div className="mt-2 flex gap-2">
        <input value={consulta} onChange={(e) => setConsulta(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (consulta.trim()) pesquisar(true); } }} placeholder="…ou digite o nome/modelo do produto" className="campo !py-2 text-sm" />
        <button type="button" disabled={pend || !consulta.trim()} onClick={() => pesquisar(true)} className="shrink-0 rounded-xl border border-ouro-escuro px-3 text-xs font-semibold text-ouro-escuro disabled:opacity-40">Buscar</button>
      </div>

      {resp?.erro && <p className="mt-3 text-xs text-rubi">{resp.erro}</p>}
      {resp?.ident && <p className="mt-3 text-xs text-jade">Reconhecido: <b>{resp.ident.titulo}</b> — campos vazios preenchidos.</p>}
      {resp?.erroPreco && <p className="mt-2 text-xs text-rubi">{resp.erroPreco}</p>}

      {p && (
        <div className="mt-3 rounded-xl border filete bg-white p-3 text-left">
          {p.simulado && <p className="mb-2 rounded-lg bg-ouro/15 px-2 py-1 text-center text-[11px] font-semibold text-ouro-escuro">SIMULAÇÃO — Mercado Livre ainda não conectado; preços de exemplo.</p>}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Menor", p.minCents], ["Preço do meio", p.medianaCents], ["Maior", p.maxCents]].map(([r, v]) => (
              <div key={r as string} className="rounded-lg bg-grafite p-2">
                <p className="text-[10px] uppercase tracking-wider text-cinza">{r}</p>
                <p className="font-bold">{brl(v as number)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-sm">
            Sugerido (−{p.descontoPct}%): <b className="text-lg text-ouro-escuro">{brl(p.sugeridoCents)}</b>
          </p>
          <p className="text-center text-[11px] text-cinza">
            {p.anuncios.length} anúncio(s) novos{p.descartados ? ` · ${p.descartados} fora da curva descartado(s)` : ""} · busca: “{p.consulta}”
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-center text-xs text-ouro-escuro underline underline-offset-2">Conferir anúncios usados no cálculo</summary>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {p.anuncios.slice(0, 15).map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <a href={a.link} target="_blank" className="line-clamp-1 underline-offset-2 hover:underline">{a.titulo}</a>
                  <span className="shrink-0 font-semibold">{brl(a.precoCents)}</span>
                </li>
              ))}
            </ul>
          </details>
          <button type="button" onClick={() => onAplicar(p)} className="mt-2 w-full text-xs text-cinza underline underline-offset-2">Aplicar de novo nos campos de preço</button>
        </div>
      )}
    </section>
  );
}
