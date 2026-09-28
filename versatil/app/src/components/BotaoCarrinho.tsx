"use client";
import Link from "next/link";
import { useCarrinho } from "./carrinho";

export function BotaoCarrinho() {
  const { qtd, pronto } = useCarrinho();
  return (
    <Link href="/carrinho" className="relative flex h-10 w-10 items-center justify-center text-marfim" aria-label="Carrinho">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" />
        <circle cx="9.5" cy="19.5" r="1.3" />
        <circle cx="17" cy="19.5" r="1.3" />
      </svg>
      {pronto && qtd > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-noite px-1 text-[11px] font-semibold text-ouro-claro">{qtd}</span>
      )}
    </Link>
  );
}
