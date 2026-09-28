import Link from "next/link";
import { FotoProduto } from "./FotoProduto";
import { brl, CONDICOES, descontoPct } from "@/lib/format";

export type ProdutoCard = {
  slug: string;
  codigo: number;
  titulo: string;
  condicao: string;
  marca?: string | null;
  precoCents: number;
  precoMercadoCents: number | null;
  estoqueDisponivel: number;
  estoqueReservado: number;
  status: string;
  fotos: { arquivo: string }[];
};

/** Código interno curto (etiqueta/PDV) — só no painel. */
export const codigoInterno = (n: number) => `#${String(n).padStart(4, "0")}`;

export function CardProduto({ p, i = 0 }: { p: ProdutoCard; i?: number }) {
  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  const esgotado = p.status === "ESGOTADO";
  const reservado = !esgotado && p.estoqueDisponivel === 0 && p.estoqueReservado > 0;
  const indisponivel = esgotado || reservado;
  return (
    <Link
      href={`/p/${p.slug}`}
      className="entrada group flex flex-col overflow-hidden rounded-2xl border filete bg-carvao transition hover:-translate-y-0.5 hover:border-ouro-escuro hover:shadow-[0_12px_30px_-18px_rgba(212,175,85,0.5)]"
      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
    >
      <div className="relative aspect-square overflow-hidden bg-white">
        <FotoProduto
          arquivo={p.fotos[0]?.arquivo}
          alt={p.titulo}
          miniatura
          className={`h-full w-full transition duration-500 group-hover:scale-[1.04] ${indisponivel ? "opacity-40 grayscale" : ""}`}
        />
        {desc > 0 && !indisponivel && (
          <span className="absolute left-2 top-2 rounded-full bg-ouro px-2 py-0.5 text-[11px] font-extrabold text-noite shadow">-{desc}%</span>
        )}
        {indisponivel && (
          <span className="absolute inset-x-0 bottom-0 bg-noite/85 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-marfim">
            {esgotado ? "Esgotado" : "Reservado"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center gap-1 px-3 pb-3.5 pt-3 text-center">
        <span className="rounded-full bg-grafite px-2 py-0.5 text-[10px] font-semibold text-cinza">{CONDICOES[p.condicao]?.rotulo}</span>
        <h3 className="line-clamp-2 min-h-[2.6em] text-[13px] font-semibold leading-snug text-marfim sm:text-sm">{p.titulo}</h3>
        <div className="mt-auto pt-1">
          {p.precoMercadoCents && p.precoMercadoCents > p.precoCents && (
            <p className="text-[12px] text-cinza line-through">{brl(p.precoMercadoCents)}</p>
          )}
          <p className="texto-ouro text-lg font-extrabold leading-tight sm:text-xl">{brl(p.precoCents)}</p>
          <p className="text-[10px] text-cinza">no Pix ou cartão</p>
        </div>
        {!indisponivel && p.estoqueDisponivel === 1 && <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-rubi">Última unidade</p>}
      </div>
    </Link>
  );
}
