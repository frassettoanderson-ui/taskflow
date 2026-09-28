"use client";
import Link from "next/link";
import { useCarrinho } from "@/components/carrinho";
import { FotoProduto } from "@/components/FotoProduto";
import { Martelo } from "@/components/Martelo";
import { brl } from "@/lib/format";

export default function Carrinho() {
  const { itens, pronto, alterar, remover, totalCents } = useCarrinho();
  if (!pronto) return null;

  if (!itens.length)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Martelo className="mx-auto mb-5 h-14 w-14 text-ouro-escuro/60" />
        <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
        <p className="mt-2 text-sm text-cinza">Os melhores lotes saem rápido. Dá uma olhada na vitrine.</p>
        <Link href="/" className="botao-ouro mt-6 inline-block rounded-xl px-6 py-3">Ver oportunidades</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-8">
      <h1 className="mb-6 text-center text-2xl font-extrabold">Seu carrinho</h1>
      <ul className="space-y-3">
        {itens.map((i) => (
          <li key={i.produtoId} className="flex gap-3 rounded-2xl border filete bg-carvao/70 p-3">
            <Link href={`/p/${i.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
              <FotoProduto arquivo={i.foto} alt={i.titulo} miniatura className="h-full w-full" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="line-clamp-2 text-sm font-semibold">{i.titulo}</p>
              <p className="texto-ouro mt-auto text-lg font-extrabold">{brl(i.precoCents * i.quantidade)}</p>
            </div>
            <div className="flex flex-col items-end justify-between">
              <button onClick={() => remover(i.produtoId)} className="text-xs text-cinza underline underline-offset-2">remover</button>
              {i.max > 1 ? (
                <div className="flex items-center rounded-full border filete">
                  <button onClick={() => alterar(i.produtoId, i.quantidade - 1)} className="h-8 w-8 text-ouro">−</button>
                  <span className="w-6 text-center font-mono text-sm">{i.quantidade}</span>
                  <button onClick={() => alterar(i.produtoId, i.quantidade + 1)} className="h-8 w-8 text-ouro">+</button>
                </div>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-wider text-rubi">única</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-2xl border filete p-5 text-center">
        <p className="text-sm text-cinza">Total</p>
        <p className="texto-ouro text-3xl font-extrabold">{brl(totalCents)}</p>
        <p className="mt-1 text-xs text-cinza">Um pagamento só para o carrinho inteiro · retirada na loja</p>
        <Link href="/checkout" className="botao-ouro mt-4 block rounded-xl py-4 text-base">Finalizar compra</Link>
        <Link href="/" className="mt-3 inline-block text-sm text-ouro-claro">Continuar olhando</Link>
      </div>
    </div>
  );
}
