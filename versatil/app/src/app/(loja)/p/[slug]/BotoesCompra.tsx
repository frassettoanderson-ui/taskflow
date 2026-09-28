"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho, type ItemCarrinho } from "@/components/carrinho";
import { brl } from "@/lib/format";

export function BotoesCompra({ produto, disponivel }: { produto: Omit<ItemCarrinho, "quantidade">; disponivel: boolean }) {
  const { adicionar } = useCarrinho();
  const router = useRouter();
  const [q, setQ] = useState(1);
  const [adicionado, setAdicionado] = useState(false);

  if (!disponivel)
    return (
      <p className="mt-5 w-full rounded-xl border filete px-4 py-3 text-center text-sm text-cinza">
        Este produto não está disponível no momento.
      </p>
    );

  const comprar = () => {
    adicionar(produto, q);
    router.push("/checkout");
  };
  const aoCarrinho = () => {
    adicionar(produto, q);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 2200);
  };

  return (
    <>
      {produto.max > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="text-xs uppercase tracking-wider text-cinza">Quantidade</span>
          <div className="flex items-center rounded-full border filete">
            <button onClick={() => setQ(Math.max(1, q - 1))} className="h-10 w-10 text-lg text-ouro" aria-label="Diminuir">−</button>
            <span className="w-8 text-center font-mono">{q}</span>
            <button onClick={() => setQ(Math.min(produto.max, q + 1))} className="h-10 w-10 text-lg text-ouro" aria-label="Aumentar">+</button>
          </div>
        </div>
      )}
      <div className="mt-5 hidden w-full gap-3 md:flex">
        <button onClick={comprar} className="botao-ouro flex-1 rounded-xl py-4 text-base">Comprar agora</button>
        <button onClick={aoCarrinho} className="rounded-xl border border-ouro-escuro px-5 text-sm font-semibold text-ouro-claro">
          {adicionado ? "Adicionado ✓" : "Carrinho"}
        </button>
      </div>
      {/* barra fixa no celular */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t filete bg-noite/95 px-4 pt-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={aoCarrinho} className="h-13 shrink-0 rounded-xl border border-ouro-escuro px-4 text-sm font-semibold text-ouro-claro" aria-label="Adicionar ao carrinho">
            {adicionado ? "✓" : "+ Carrinho"}
          </button>
          <button onClick={comprar} className="botao-ouro h-13 flex-1 rounded-xl text-base">
            Comprar · {brl(produto.precoCents * q)}
          </button>
        </div>
      </div>
    </>
  );
}
