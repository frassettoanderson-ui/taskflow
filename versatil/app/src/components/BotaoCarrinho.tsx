"use client";
import Link from "next/link";
import { useCarrinho } from "./carrinho";

export function BotaoCarrinho() {
  const { qtd, pronto } = useCarrinho();
  return (
    <Link href="/carrinho" className="relative flex h-11 w-11 items-center justify-center rounded-full border filete bg-carvao/80 text-ouro" aria-label="Carrinho">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" />
        <path d="M9 10V6a3 3 0 0 1 6 0v4" />
      </svg>
      {pronto && qtd > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ouro px-1 font-mono text-[11px] font-semibold text-noite">{qtd}</span>
      )}
    </Link>
  );
}
