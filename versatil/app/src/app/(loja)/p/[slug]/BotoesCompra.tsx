"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho, type ItemCarrinho } from "@/components/carrinho";
import { brl } from "@/lib/format";

/** Bloco de compra da "caixa" lateral (padrão ML) + barra fixa no celular. */
export function BotoesCompra({ produto, disponivel }: { produto: Omit<ItemCarrinho, "quantidade">; disponivel: boolean }) {
  const { adicionar } = useCarrinho();
  const router = useRouter();
  const [q, setQ] = useState(1);
  const [adicionado, setAdicionado] = useState(false);

  if (!disponivel)
    return <p className="mt-4 rounded-[6px] bg-grafite px-4 py-3 text-center text-[14px] text-cinza">Este produto não está disponível no momento.</p>;

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
      <label className="mt-4 flex items-center gap-2 text-[14px]">
        <span>Quantidade:</span>
        <select value={q} onChange={(e) => setQ(Number(e.target.value))} className="rounded-[4px] bg-transparent font-semibold outline-none">
          {Array.from({ length: Math.min(produto.max, 10) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "unidade" : "unidades"}
            </option>
          ))}
        </select>
        <span className="text-[13px] text-cinza">({produto.max} disponíve{produto.max === 1 ? "l" : "is"})</span>
      </label>
      <div className="mt-5 space-y-2">
        <button onClick={comprar} className="botao-principal h-12 w-full text-[16px]">Comprar agora</button>
        <button onClick={aoCarrinho} className="botao-secundario h-12 w-full text-[16px]">{adicionado ? "Adicionado ao carrinho ✓" : "Adicionar ao carrinho"}</button>
      </div>

      {/* barra fixa no celular: quem chega pelo link do grupo compra sem rolar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-fio bg-white px-3 pt-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] md:hidden">
        <div className="flex gap-2">
          <button onClick={aoCarrinho} className="botao-secundario h-12 shrink-0 px-4 text-[14px]" aria-label="Adicionar ao carrinho">
            {adicionado ? "✓" : "Carrinho"}
          </button>
          <button onClick={comprar} className="botao-principal h-12 flex-1 text-[15px]">
            Comprar · {brl(produto.precoCents * q)}
          </button>
        </div>
      </div>
    </>
  );
}
