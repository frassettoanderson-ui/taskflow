"use client";
import { useLayoutEffect, useRef } from "react";

/** Faixa horizontal com setas (desktop) e arraste (celular), como os carrosséis de produtos do ML. */
export function Carrossel({ children, chave }: { children: React.ReactNode; chave?: string | number }) {
  const trilho = useRef<HTMLDivElement>(null);
  // quando entram itens no começo (ex.: cards pessoais), volta para o início em vez de "pular"
  useLayoutEffect(() => {
    const el = trilho.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "instant" });
    const r = requestAnimationFrame(() => el.scrollTo({ left: 0, behavior: "instant" })); // o snap pode re-ancorar no frame seguinte
    return () => cancelAnimationFrame(r);
  }, [chave]);
  const mover = (dir: number) => trilho.current?.scrollBy({ left: dir * trilho.current.clientWidth * 0.8, behavior: "smooth" });
  const seta = "absolute top-1/2 z-10 hidden h-16 w-8 -translate-y-1/2 items-center justify-center bg-white text-2xl text-[#3483fa] shadow-[0_1px_4px_rgba(0,0,0,0.25)] md:flex";
  return (
    <div className="relative">
      <button onClick={() => mover(-1)} className={`${seta} -left-4 rounded-r-full`} aria-label="Anterior">
        <span className="text-ouro-escuro">‹</span>
      </button>
      <div ref={trilho} className="sem-barra flex snap-x gap-3 overflow-x-auto scroll-smooth pb-1 [overflow-anchor:none] md:gap-4">
        {children}
      </div>
      <button onClick={() => mover(1)} className={`${seta} -right-4 rounded-l-full`} aria-label="Próximo">
        <span className="text-ouro-escuro">›</span>
      </button>
    </div>
  );
}
