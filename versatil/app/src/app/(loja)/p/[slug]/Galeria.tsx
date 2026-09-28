"use client";
import { useRef, useState } from "react";
import { FotoProduto } from "@/components/FotoProduto";

/** Galeria no padrão ML: miniaturas na vertical à esquerda (desktop) e carrossel com contador (celular). */
export function Galeria({ fotos, titulo, apagada }: { fotos: { id: string; arquivo: string }[]; titulo: string; apagada: boolean }) {
  const [atual, setAtual] = useState(0);
  const trilho = useRef<HTMLDivElement>(null);
  const lista = fotos.length ? fotos : [{ id: "vazio", arquivo: "" }];

  return (
    <div className="flex min-w-0 gap-3">
      {lista.length > 1 && (
        <div className="hidden w-12 shrink-0 flex-col gap-2 md:flex">
          {lista.map((f, i) => (
            <button
              key={f.id}
              onMouseEnter={() => setAtual(i)}
              onClick={() => setAtual(i)}
              className={`h-12 w-12 overflow-hidden rounded-[4px] border bg-white ${i === atual ? "border-2 border-ouro-escuro" : "border-[#d4d4d4]"}`}
            >
              <FotoProduto arquivo={f.arquivo} alt="" miniatura className="h-full w-full !object-contain p-0.5" />
            </button>
          ))}
        </div>
      )}

      {/* desktop: foto principal */}
      <div className="hidden aspect-square min-w-0 flex-1 items-center justify-center overflow-hidden bg-white md:flex">
        <FotoProduto arquivo={lista[atual].arquivo || null} alt={titulo} className={`h-full w-full !object-contain ${apagada ? "opacity-50 grayscale" : ""}`} />
      </div>

      {/* celular: carrossel com arraste */}
      <div className="relative w-full md:hidden">
        <div
          ref={trilho}
          onScroll={(e) => setAtual(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="sem-barra flex snap-x snap-mandatory overflow-x-auto bg-white"
        >
          {lista.map((f, i) => (
            <div key={f.id} className="aspect-square w-full shrink-0 snap-center">
              <FotoProduto arquivo={f.arquivo || null} alt={`${titulo} — foto ${i + 1}`} className={`h-full w-full !object-contain ${apagada ? "opacity-50 grayscale" : ""}`} />
            </div>
          ))}
        </div>
        {lista.length > 1 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#ededed] px-2.5 py-0.5 text-[12px] text-marfim/80">
            {atual + 1} / {lista.length}
          </span>
        )}
      </div>
    </div>
  );
}
