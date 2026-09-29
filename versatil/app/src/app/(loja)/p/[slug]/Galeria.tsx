"use client";
import { useRef, useState } from "react";
import { FotoProduto } from "@/components/FotoProduto";

type Item = { id: string; tipo: "foto"; arquivo: string } | { id: string; tipo: "video"; url: string };

function idYoutube(url: string) {
  const m = /(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/.exec(url);
  return m?.[1] ?? null;
}

function Midia({ item, titulo, apagada, miniatura = false, prioridade = false }: { item: Item; titulo: string; apagada: boolean; miniatura?: boolean; prioridade?: boolean }) {
  if (item.tipo === "foto")
    return <FotoProduto arquivo={item.arquivo || null} alt={titulo} miniatura={miniatura} prioridade={prioridade} className={`h-full w-full !object-contain ${apagada ? "opacity-50 grayscale" : ""}`} />;
  const yt = idYoutube(item.url);
  if (yt)
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1`}
        title={`Vídeo — ${titulo}`}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    );
  return <video src={item.url} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" />;
}

function MiniVideo() {
  return (
    <span className="flex h-full w-full items-center justify-center bg-noite text-white">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
    </span>
  );
}

/** Galeria no padrão ML: miniaturas na vertical (desktop), carrossel com contador (celular), vídeo como 2º item. */
export function Galeria({ fotos, video, titulo, apagada }: { fotos: { id: string; arquivo: string }[]; video?: string | null; titulo: string; apagada: boolean }) {
  const itens: Item[] = fotos.map((f) => ({ id: f.id, tipo: "foto" as const, arquivo: f.arquivo }));
  if (video) itens.splice(Math.min(1, itens.length), 0, { id: "video", tipo: "video", url: video });
  if (!itens.length) itens.push({ id: "vazio", tipo: "foto", arquivo: "" });
  const [atual, setAtual] = useState(0);
  const trilho = useRef<HTMLDivElement>(null);
  const sel = itens[Math.min(atual, itens.length - 1)];

  return (
    <div className="flex min-w-0 gap-3">
      {itens.length > 1 && (
        <div className="hidden w-12 shrink-0 flex-col gap-2 md:flex">
          {itens.map((it, i) => (
            <button
              key={it.id}
              onMouseEnter={() => it.tipo === "foto" && setAtual(i)}
              onClick={() => setAtual(i)}
              aria-label={it.tipo === "video" ? "Ver vídeo" : `Foto ${i + 1}`}
              className={`h-12 w-12 overflow-hidden rounded-[4px] border bg-white ${i === atual ? "border-2 border-ouro-escuro" : "border-[#d4d4d4]"}`}
            >
              {it.tipo === "video" ? <MiniVideo /> : <FotoProduto arquivo={it.arquivo} alt="" miniatura className="h-full w-full !object-contain p-0.5" />}
            </button>
          ))}
        </div>
      )}

      {/* desktop: mídia principal */}
      <div className="hidden aspect-square min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[6px] bg-white md:flex">
        <Midia item={sel} titulo={titulo} apagada={apagada} prioridade />
      </div>

      {/* celular: carrossel com arraste */}
      <div className="relative w-full md:hidden">
        <div
          ref={trilho}
          onScroll={(e) => setAtual(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="sem-barra flex snap-x snap-mandatory overflow-x-auto bg-white"
        >
          {itens.map((it, i) => (
            <div key={it.id} className="aspect-square w-full shrink-0 snap-center">
              <Midia item={it} titulo={titulo} apagada={apagada} prioridade={i === 0} />
            </div>
          ))}
        </div>
        {itens.length > 1 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#ededed] px-2.5 py-0.5 text-[12px] text-marfim/80">
            {atual + 1} / {itens.length}
          </span>
        )}
      </div>
    </div>
  );
}
