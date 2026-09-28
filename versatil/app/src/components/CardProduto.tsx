import Link from "next/link";
import { FotoProduto } from "./FotoProduto";
import { brl, CONDICOES, descontoPct } from "@/lib/format";

export type ProdutoCard = {
  slug: string;
  codigo: number;
  titulo: string;
  condicao: string;
  precoCents: number;
  precoMercadoCents: number | null;
  estoqueDisponivel: number;
  estoqueReservado: number;
  status: string;
  fotos: { arquivo: string }[];
};

export const lote = (n: number) => `LOTE ${String(n).padStart(4, "0")}`;

export function CardProduto({ p, i = 0 }: { p: ProdutoCard; i?: number }) {
  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  const arrematado = p.status === "ESGOTADO";
  const reservado = !arrematado && p.estoqueDisponivel === 0 && p.estoqueReservado > 0;
  return (
    <Link
      href={`/p/${p.slug}`}
      className="entrada group flex flex-col overflow-hidden rounded-2xl border filete bg-carvao/70 transition hover:border-ouro-escuro"
      style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
    >
      <div className="relative aspect-square overflow-hidden">
        <FotoProduto
          arquivo={p.fotos[0]?.arquivo}
          alt={p.titulo}
          miniatura
          className={`h-full w-full transition duration-500 group-hover:scale-[1.04] ${arrematado || reservado ? "opacity-45 grayscale" : ""}`}
        />
        <span className="absolute left-2 top-2 rounded-md bg-noite/80 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-ouro-claro">{lote(p.codigo)}</span>
        {desc > 0 && !arrematado && (
          <span className="absolute right-2 top-2 rounded-md bg-ouro px-1.5 py-0.5 font-mono text-[11px] font-semibold text-noite">-{desc}%</span>
        )}
        {arrematado && <span className="carimbo absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] sm:text-sm">Arrematado</span>}
        {reservado && <span className="carimbo absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px]">Reservado</span>}
      </div>
      <div className="flex flex-1 flex-col items-center gap-1 px-3 pb-3 pt-2.5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cinza">{CONDICOES[p.condicao]?.rotulo}</p>
        <h3 className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-marfim sm:text-sm">{p.titulo}</h3>
        <div className="mt-auto pt-1">
          {p.precoMercadoCents && p.precoMercadoCents > p.precoCents && (
            <p className="font-serif text-[13px] italic text-cinza line-through decoration-rubi/60">{brl(p.precoMercadoCents)}</p>
          )}
          <p className="texto-ouro text-lg font-extrabold leading-none sm:text-xl">{brl(p.precoCents)}</p>
        </div>
        {!arrematado && !reservado && p.estoqueDisponivel === 1 && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-rubi">Última unidade</p>
        )}
        {!arrematado && !reservado && p.estoqueDisponivel > 1 && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-cinza">Restam {p.estoqueDisponivel}</p>
        )}
      </div>
    </Link>
  );
}
