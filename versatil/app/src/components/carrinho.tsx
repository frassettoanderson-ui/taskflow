"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ItemCarrinho = { produtoId: string; slug: string; titulo: string; precoCents: number; foto?: string | null; max: number; quantidade: number };
type Ctx = {
  itens: ItemCarrinho[];
  pronto: boolean;
  adicionar: (i: Omit<ItemCarrinho, "quantidade">, q?: number) => void;
  alterar: (produtoId: string, q: number) => void;
  remover: (produtoId: string) => void;
  limpar: () => void;
  totalCents: number;
  qtd: number;
};

const C = createContext<Ctx | null>(null);
const CHAVE = "versatil_carrinho";

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(CHAVE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s) setItens(JSON.parse(s));
    } catch {}
    setPronto(true);
  }, []);
  useEffect(() => {
    if (!pronto) return;
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch {}
  }, [itens, pronto]);

  const adicionar = useCallback((i: Omit<ItemCarrinho, "quantidade">, q = 1) => {
    setItens((atual) => {
      const ex = atual.find((x) => x.produtoId === i.produtoId);
      if (ex) return atual.map((x) => (x.produtoId === i.produtoId ? { ...x, ...i, quantidade: Math.min(i.max, x.quantidade + q) } : x));
      return [...atual, { ...i, quantidade: Math.min(i.max, q) }];
    });
  }, []);
  const alterar = useCallback((id: string, q: number) => setItens((a) => a.map((x) => (x.produtoId === id ? { ...x, quantidade: Math.max(1, Math.min(x.max, q)) } : x))), []);
  const remover = useCallback((id: string) => setItens((a) => a.filter((x) => x.produtoId !== id)), []);
  const limpar = useCallback(() => setItens([]), []);

  const valor = useMemo(
    () => ({ itens, pronto, adicionar, alterar, remover, limpar, totalCents: itens.reduce((s, i) => s + i.precoCents * i.quantidade, 0), qtd: itens.reduce((s, i) => s + i.quantidade, 0) }),
    [itens, pronto, adicionar, alterar, remover, limpar],
  );
  return <C.Provider value={valor}>{children}</C.Provider>;
}

export function useCarrinho() {
  const c = useContext(C);
  if (!c) throw new Error("useCarrinho fora do provider");
  return c;
}
