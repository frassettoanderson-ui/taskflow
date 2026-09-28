"use client";
import { useRef, useState } from "react";
import { FotoProduto } from "@/components/FotoProduto";

export function Galeria({ fotos, titulo, apagada }: { fotos: { id: string; arquivo: string }[]; titulo: string; apagada: boolean }) {
  const [atual, setAtual] = useState(0);
  const trilho = useRef<HTMLDivElement>(null);
  const lista = fotos.length ? fotos : [{ id: "vazio", arquivo: "" }];

  const irPara = (i: number) => {
    setAtual(i);
    trilho.current?.children[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div>
      <div
        ref={trilho}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtual(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto bg-white [scrollbar-width:none] sm:rounded-2xl"
      >
        {lista.map((f, i) => (
          <div key={f.id} className="aspect-square w-full shrink-0 snap-center">
            <FotoProduto arquivo={f.arquivo || null} alt={`${titulo} — foto ${i + 1}`} className={`h-full w-full !object-contain ${apagada ? "opacity-50 grayscale" : ""}`} />
          </div>
        ))}
      </div>
      {lista.length > 1 && (
        <>
          <div className="mt-2 flex justify-center gap-1.5 sm:hidden">
            {lista.map((f, i) => <span key={f.id} className={`h-1.5 rounded-full transition-all ${i === atual ? "w-5 bg-ouro" : "w-1.5 bg-fio"}`} />)}
          </div>
          <div className="mt-3 hidden gap-2 sm:flex">
            {lista.map((f, i) => (
              <button key={f.id} onClick={() => irPara(i)} className={`h-16 w-16 overflow-hidden rounded-lg border-2 bg-white ${i === atual ? "border-ouro" : "border-transparent opacity-70"}`}>
                <FotoProduto arquivo={f.arquivo} alt="" miniatura className="h-full w-full" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
