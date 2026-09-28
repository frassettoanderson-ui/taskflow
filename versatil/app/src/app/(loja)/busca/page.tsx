import Link from "next/link";
import type { Metadata } from "next";
import type { Condicao, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { expirarPedidos } from "@/lib/pedidos";
import { selecaoCard } from "@/lib/catalogo";
import { CONDICOES, parseReais } from "@/lib/format";
import { CardProduto } from "@/components/CardProduto";
import { IconeSacola } from "@/components/Icones";

export const dynamic = "force-dynamic";

const ORDENS: Record<string, string> = { relevancia: "Recentes", desconto: "Maior desconto", menor: "Menor preço", maior: "Maior preço" };

export async function generateMetadata({ searchParams }: PageProps<"/busca">): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q ? `${q} — busca` : "Todos os produtos" };
}

export default async function Busca({ searchParams }: PageProps<"/busca">) {
  await expirarPedidos();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = str("q");
  const cat = str("cat");
  const cond = str("cond");
  const min = parseReais(str("min"));
  const max = parseReais(str("max"));
  const ordem = str("ordem") in ORDENS ? str("ordem") : "relevancia";

  const where: Prisma.ProdutoWhereInput = {
    status: "ATIVO",
    ...(q ? { OR: (["titulo", "marca", "sku", "aplicacao", "descricao"] as const).map((c) => ({ [c]: { contains: q, mode: "insensitive" as const } })) } : {}),
    ...(cat ? { categoria: { slug: cat } } : {}),
    ...(cond && cond in CONDICOES ? { condicao: cond as Condicao } : {}),
    ...(min || max ? { precoCents: { ...(min ? { gte: min } : {}), ...(max ? { lte: max } : {}) } } : {}),
  };
  const orderBy: Prisma.ProdutoOrderByWithRelationInput =
    ordem === "menor" ? { precoCents: "asc" } : ordem === "maior" ? { precoCents: "desc" } : { publicadoEm: "desc" };

  const [produtos, categorias, contCond] = await Promise.all([
    db.produto.findMany({ where, select: selecaoCard, orderBy, take: 300 }),
    db.categoria.findMany({
      where: { produtos: { some: { status: "ATIVO" } } },
      orderBy: { ordem: "asc" },
      include: { _count: { select: { produtos: { where: { status: "ATIVO" } } } } },
    }),
    db.produto.groupBy({ by: ["condicao"], where: { status: "ATIVO" }, _count: true }),
  ]);
  const pct = (p: (typeof produtos)[number]) => (p.precoMercadoCents ? 1 - p.precoCents / p.precoMercadoCents : 0);
  if (ordem === "desconto") produtos.sort((a, b) => pct(b) - pct(a));

  const atual = { q, cat, cond, min: str("min"), max: str("max"), ordem };
  const url = (mudar: Partial<typeof atual>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...atual, ...mudar })) if (v && !(k === "ordem" && v === "relevancia")) p.set(k, v);
    const s = p.toString();
    return `/busca${s ? `?${s}` : ""}`;
  };
  const catAtual = categorias.find((c) => c.slug === cat);
  const titulo = q || (catAtual ? catAtual.nome : max && !min ? `Até R$ ${str("max")}` : "Todos os produtos");
  const filtrosAtivos = [cat, cond, str("min"), str("max")].filter(Boolean).length;
  const link = (ativo: boolean) => (ativo ? "font-semibold text-marfim" : "text-marfim/70 hover:text-marfim");

  const filtros = (
    <div className="space-y-6 text-[14px]">
      {filtrosAtivos > 0 && (
        <Link href={url({ cat: "", cond: "", min: "", max: "" })} className="text-[13px] text-ouro-escuro hover:underline">
          Limpar filtros
        </Link>
      )}
      <div>
        <p className="mb-2 font-semibold">Categorias</p>
        <ul className="space-y-1.5">
          {categorias.map((c) => (
            <li key={c.id}>
              <Link href={url({ cat: cat === c.slug ? "" : c.slug })} className={link(cat === c.slug)}>
                {c.nome} <span className="text-cinza">({c._count.produtos})</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 font-semibold">Condição</p>
        <ul className="space-y-1.5">
          {Object.entries(CONDICOES).map(([k, v]) => {
            const n = contCond.find((c) => c.condicao === k)?._count ?? 0;
            if (!n) return null;
            return (
              <li key={k}>
                <Link href={url({ cond: cond === k ? "" : k })} className={link(cond === k)}>
                  {v.rotulo} <span className="text-cinza">({n})</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="mb-2 font-semibold">Preço</p>
        <ul className="mb-3 space-y-1.5">
          {[
            ["", "50", "Até R$ 50"],
            ["50", "150", "R$ 50 a R$ 150"],
            ["150", "500", "R$ 150 a R$ 500"],
            ["500", "", "Mais de R$ 500"],
          ].map(([a, b, r]) => (
            <li key={r}>
              <Link href={url({ min: a, max: b })} className={link(str("min") === a && str("max") === b && Boolean(a || b))}>
                {r}
              </Link>
            </li>
          ))}
        </ul>
        <form action="/busca" className="flex items-center gap-2">
          {Object.entries(atual)
            .filter(([k, v]) => v && k !== "min" && k !== "max")
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <input name="min" defaultValue={str("min")} placeholder="Mínimo" inputMode="numeric" className="h-8 w-20 rounded-full border border-[#d4d4d4] bg-white px-3 text-[13px] outline-none" />
          <span className="text-cinza">-</span>
          <input name="max" defaultValue={str("max")} placeholder="Máximo" inputMode="numeric" className="h-8 w-20 rounded-full border border-[#d4d4d4] bg-white px-3 text-[13px] outline-none" />
          <button aria-label="Aplicar preço" className="flex h-8 w-8 items-center justify-center rounded-full bg-noite text-ouro-claro">
            ›
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1200px] px-3 py-4 md:px-4 md:py-6">
      <div className="md:grid md:grid-cols-[230px_1fr] md:gap-6">
        <aside className="hidden md:block">
          <h1 className="text-[22px] font-semibold leading-tight">{titulo}</h1>
          <p className="mb-5 mt-1 text-[13px] text-cinza">{produtos.length} resultado(s)</p>
          {filtros}
        </aside>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="md:hidden">
              <h1 className="text-[18px] font-semibold leading-tight">{titulo}</h1>
              <p className="text-[12px] text-cinza">{produtos.length} resultado(s)</p>
            </div>
            <div className="sem-barra ml-auto flex max-w-full items-center gap-2 overflow-x-auto text-[13px]">
              <span className="hidden shrink-0 text-marfim/70 sm:inline">Ordenar por</span>
              <div className="flex shrink-0 overflow-hidden rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
                {Object.entries(ORDENS).map(([k, v]) => (
                  <Link key={k} href={url({ ordem: k })} className={`whitespace-nowrap px-3 py-1.5 ${ordem === k ? "bg-noite font-semibold text-ouro-claro" : "text-marfim/70"}`}>
                    {v}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <details className="cartao mb-3 md:hidden">
            <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-semibold">
              Filtros {filtrosAtivos > 0 && <span className="ml-1 rounded-full bg-noite px-2 text-[11px] text-ouro-claro">{filtrosAtivos}</span>}
            </summary>
            <div className="border-t border-fio p-4">{filtros}</div>
          </details>

          {produtos.length === 0 ? (
            <div className="cartao py-16 text-center">
              <IconeSacola className="mx-auto mb-3 h-12 w-12 text-cinza/50" />
              <p className="text-[18px] font-semibold">Não encontramos produtos</p>
              <p className="mt-1 text-cinza">Revise a busca ou tire alguns filtros.</p>
              <Link href="/busca" className="mt-4 inline-block text-ouro-escuro hover:underline">
                Ver todos os produtos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {produtos.map((p) => (
                <CardProduto key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
