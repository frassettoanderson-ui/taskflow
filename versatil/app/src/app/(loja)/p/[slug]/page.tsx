import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { expirarPedidos } from "@/lib/pedidos";
import { brl, CONDICOES, descontoPct } from "@/lib/format";
import { urlFoto } from "@/lib/uploads-url";
import { FotoProduto } from "@/components/FotoProduto";
import { lote } from "@/components/CardProduto";
import { BotoesCompra } from "./BotoesCompra";

export const dynamic = "force-dynamic";

const buscar = (slug: string) =>
  db.produto.findUnique({
    where: { slug },
    include: { fotos: { orderBy: { ordem: "asc" } }, categoria: true },
  });

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const p = await buscar((await params).slug);
  if (!p) return {};
  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  const titulo = `${p.titulo} — ${brl(p.precoCents)}`;
  const descricao = `${CONDICOES[p.condicao].rotulo}${desc ? ` · ${desc}% abaixo do mercado` : ""}. Retire na loja Versátil.`;
  const img = p.fotos[0] ? urlFoto(p.fotos[0].arquivo) : "/icone-512.png";
  return {
    title: titulo,
    description: descricao,
    openGraph: { title: titulo, description: descricao, images: [img], type: "website" },
  };
}

export default async function PaginaProduto({ params }: PageProps<"/p/[slug]">) {
  await expirarPedidos();
  const p = await buscar((await params).slug);
  if (!p || p.status === "RASCUNHO" || p.status === "ARQUIVADO") notFound();

  after(() => db.produto.update({ where: { id: p.id }, data: { visualizacoes: { increment: 1 } } }).catch(() => {}));

  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  const arrematado = p.status === "ESGOTADO";
  const reservado = !arrematado && p.estoqueDisponivel === 0 && p.estoqueReservado > 0;
  const cond = CONDICOES[p.condicao];

  return (
    <div className="mx-auto max-w-5xl pb-28 sm:px-4 sm:pt-8 md:pb-10">
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        {/* galeria: rolagem lateral com snap no celular */}
        <div>
          <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:rounded-2xl sm:border filete">
            {(p.fotos.length ? p.fotos : [null]).map((f, i) => (
              <div key={f?.id ?? i} className="relative aspect-square w-full shrink-0 snap-center">
                <FotoProduto arquivo={f?.arquivo} alt={`${p.titulo} — foto ${i + 1}`} className={`h-full w-full ${arrematado ? "opacity-50 grayscale" : ""}`} />
                {p.fotos.length > 1 && (
                  <span className="absolute bottom-3 right-3 rounded-full bg-noite/75 px-2 py-0.5 font-mono text-[11px] text-marfim">
                    {i + 1}/{p.fotos.length}
                  </span>
                )}
              </div>
            ))}
          </div>
          {p.fotos.length > 1 && <p className="mt-2 text-center text-[11px] text-cinza">Deslize para ver todas as fotos reais do item</p>}
        </div>

        <div className="flex flex-col items-center px-4 text-center md:items-start md:text-left">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-ouro-escuro/60 px-2 py-0.5 font-mono text-[11px] tracking-wider text-ouro-claro">{lote(p.codigo)}</span>
            {p.categoria && <span className="text-[11px] uppercase tracking-[0.14em] text-cinza">{p.categoria.nome}</span>}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{p.titulo}</h1>

          <div className="mt-3 rounded-2xl bg-grafite px-4 py-2 text-center text-xs md:text-left">
            <b className="font-semibold text-ouro-claro">{cond.rotulo}</b>
            <span className="block text-cinza">{cond.dica}</span>
          </div>

          <div className="relative mt-6 w-full rounded-2xl border filete bg-carvao/70 p-5 text-center">
            {arrematado && <span className="carimbo absolute -right-2 -top-4 text-sm">Arrematado</span>}
            {p.precoMercadoCents && p.precoMercadoCents > p.precoCents && (
              <p className="text-sm text-cinza">
                No mercado: <span className="font-serif text-base italic line-through decoration-rubi/60">{brl(p.precoMercadoCents)}</span>
              </p>
            )}
            <p className="texto-ouro mt-1 text-4xl font-extrabold tracking-tight">{brl(p.precoCents)}</p>
            {desc > 0 && <p className="mt-1 font-mono text-xs uppercase tracking-wider text-ouro">Você economiza {desc}%</p>}
            {!arrematado && !reservado && (
              <p className={`mt-3 font-mono text-[11px] uppercase tracking-wider ${p.estoqueDisponivel === 1 ? "text-rubi" : "text-cinza"}`}>
                {p.estoqueDisponivel === 1 ? "Última unidade" : `${p.estoqueDisponivel} unidades disponíveis`}
              </p>
            )}
            {reservado && (
              <p className="mt-3 text-sm text-ouro-claro">
                Alguém está pagando por este item agora. Se o pagamento não for concluído, ele volta para a vitrine em poucos minutos.
              </p>
            )}
          </div>

          <BotoesCompra
            produto={{
              produtoId: p.id,
              slug: p.slug,
              titulo: p.titulo,
              precoCents: p.precoCents,
              foto: p.fotos[0]?.arquivo ?? null,
              max: p.estoqueDisponivel,
            }}
            disponivel={!arrematado && !reservado && p.estoqueDisponivel > 0}
          />

          {p.descricao && <p className="mt-8 whitespace-pre-line text-sm leading-relaxed text-marfim/85">{p.descricao}</p>}

          <ol className="mt-8 grid w-full gap-3 text-left text-sm sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            {[
              ["Pague", "Pix ou cartão. A peça fica reservada para você enquanto paga."],
              ["Receba o código", "Pagamento aprovado gera seu código de retirada na hora."],
              ["Retire na loja", "Mostre o código no balcão, sem prazo para buscar."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border filete p-3 text-center">
                <span className="font-serif text-2xl italic text-ouro">{i + 1}</span>
                <p className="font-semibold">{t}</p>
                <p className="mt-0.5 text-xs text-cinza">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
