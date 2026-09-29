"use client";
import { useEffect } from "react";

export function BotaoImprimir({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <button onClick={() => window.print()} className="botao-ouro px-6 py-2.5 text-sm print:hidden">
      Imprimir
    </button>
  );
}
