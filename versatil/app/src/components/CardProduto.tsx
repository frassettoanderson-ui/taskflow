import Link from "next/link";
import { FotoProduto } from "./FotoProduto";
import { Preco } from "./Preco";
import { brl, CONDICOES, descontoPct } from "@/lib/format";
import type { ProdutoCard } from "@/lib/catalogo";

export type { ProdutoCard };

/** Código interno curto (etiqueta/PDV) — só no painel. */
export const codigoInterno = (n: number) => `#${String(n).padStart(4, "0")}`;

/** Card no estilo "poly-card" do Mercado Livre, com as cores da Versátil. */
export function CardProduto({ p, compacto = false }: { p: ProdutoCard; compacto?: boolean }) {
  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  const esgotado = p.status === "ESGOTADO";
  const reservado = !esgotado && p.estoqueDisponivel === 0 && p.estoqueReservado > 0;
  const indisponivel = esgotado || reservado;
  const selo = indisponivel ? null : desc >= 60 ? "OFERTA IMPERDÍVEL" : p.estoqueDisponivel === 1 ? "ÚLTIMA UNIDADE" : null;

  return (
    <Link href={`/p/${p.slug}`} className="cartao group flex h-full flex-col overflow-hidden transition hover:shadow-[0_8px_16px_rgba(0,0,0,0.12)]">
      <div className="relative aspect-square border-b border-[#f0f0f0] bg-white">
        <FotoProduto arquivo={p.fotos[0]?.arquivo} alt={p.titulo} miniatura className={`h-full w-full !object-contain p-3 ${indisponivel ? "opacity-40 grayscale" : ""}`} />
        {indisponivel && (
          <span className="absolute left-2 top-2 rounded-[3px] bg-marfim px-1.5 py-0.5 text-[11px] font-semibold text-white">{esgotado ? "ESGOTADO" : "RESERVADO"}</span>
        )}
      </div>
      <div className={`flex flex-1 flex-col text-left ${compacto ? "gap-0.5 p-3" : "gap-1 p-4"}`}>
        {selo && (
          <span className={`self-start rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold ${selo === "ÚLTIMA UNIDADE" ? "bg-rubi text-white" : "bg-noite text-ouro-claro"}`}>{selo}</span>
        )}
        <h3 className="line-clamp-2 text-[14px] font-normal leading-[1.3] text-marfim/90 group-hover:text-marfim">{p.titulo}</h3>
        <p className="text-[12px] text-cinza">
          {p.marca && <b className="font-semibold text-marfim">{p.marca} · </b>}
          {CONDICOES[p.condicao]?.rotulo}
        </p>
        <div className="mt-1">
          {p.precoMercadoCents && p.precoMercadoCents > p.precoCents && <s className="text-[12px] text-cinza">{brl(p.precoMercadoCents)}</s>}
          <div className="flex flex-wrap items-center gap-x-2">
            <Preco cents={p.precoCents} tamanho={compacto ? 20 : 24} />
            {desc > 0 && <span className="text-[14px] font-semibold text-jade">{desc}% OFF</span>}
          </div>
          <p className="text-[12px] text-cinza">no Pix ou cartão</p>
        </div>
        {!indisponivel && <p className="mt-auto pt-1 text-[13px] font-semibold text-jade">Retire na loja</p>}
      </div>
    </Link>
  );
}
