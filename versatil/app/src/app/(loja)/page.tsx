import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { expirarPedidos } from "@/lib/pedidos";
import { CardProduto } from "@/components/CardProduto";
import { IconeEscudo, IconeLoja, IconePix, IconeSacola } from "@/components/Icones";

export const dynamic = "force-dynamic";

const selecao = {
  slug: true,
  codigo: true,
  titulo: true,
  condicao: true,
  marca: true,
  precoCents: true,
  precoMercadoCents: true,
  estoqueDisponivel: true,
  estoqueReservado: true,
  status: true,
  fotos: { select: { arquivo: true }, orderBy: { ordem: "asc" }, take: 1 },
} satisfies Prisma.ProdutoSelect;

const ORDENS = {
  recentes: { rotulo: "Mais recentes", orderBy: [{ publicadoEm: "desc" }] },
  menor: { rotulo: "Menor preço", orderBy: [{ precoCents: "asc" }] },
  maior: { rotulo: "Maior preço", orderBy: [{ precoCents: "desc" }] },
} as const;

export default async function Vitrine({ searchParams }: PageProps<"/">) {
  await expirarPedidos();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const ordem = (typeof sp.ordem === "string" && sp.ordem in ORDENS ? sp.ordem : "recentes") as keyof typeof ORDENS;
  const filtrando = Boolean(q || cat);

  const where: Prisma.ProdutoWhereInput = {
    status: "ATIVO",
    ...(q
      ? { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { marca: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { aplicacao: { contains: q, mode: "insensitive" } }] }
      : {}),
    ...(cat ? { categoria: { slug: cat } } : {}),
  };
  const [produtos, categorias, vendidos] = await Promise.all([
    db.produto.findMany({ where, select: selecao, orderBy: [...ORDENS[ordem].orderBy], take: 120 }),
    db.categoria.findMany({ where: { produtos: { some: { status: "ATIVO" } } }, orderBy: { ordem: "asc" } }),
    filtrando ? Promise.resolve([]) : db.produto.findMany({ where: { status: "ESGOTADO" }, select: selecao, orderBy: { ultimaVendaEm: "desc" }, take: 4 }),
  ]);
  const catAtual = categorias.find((c) => c.slug === cat);
  const url = (o: Record<string, string>) => "/?" + new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { cat } : {}), ordem, ...o }).toString();
  const chip = (ativo: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${ativo ? "border-ouro bg-ouro text-noite" : "filete bg-carvao text-marfim/80 hover:border-ouro-escuro"}`;

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* busca no celular */}
      <form action="/" className="pt-4 md:hidden">
        <input name="q" defaultValue={q} placeholder="Buscar produtos, marcas, códigos…" className="campo !rounded-full" />
      </form>

      {!filtrando && (
        <section className="entrada relative mt-4 overflow-hidden rounded-3xl border border-ouro-escuro/40 bg-[linear-gradient(135deg,#17150f,#0b0b0c_55%)] px-5 py-6 text-center sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-ouro/15 blur-3xl" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ouro">Ofertas de hoje</p>
          <h1 className="mx-auto mt-2 max-w-2xl text-[1.7rem] font-extrabold leading-tight sm:text-5xl">
            Os mesmos produtos, <span className="texto-ouro">pagando muito menos</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-cinza sm:text-base">
            Itens de logística reversa — novos, de caixa aberta ou com pequenas avarias — conferidos pela nossa equipe. Compre pelo site e retire na loja.
          </p>
        </section>
      )}

      {!filtrando && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] sm:text-xs">
          {[
            [IconePix, "Pix ou cartão"],
            [IconeLoja, "Retire na loja"],
            [IconeEscudo, "Produtos conferidos"],
          ].map(([Icone, txt]) => {
            const I = Icone as typeof IconePix;
            return (
              <div key={txt as string} className="flex flex-col items-center gap-1 rounded-xl border filete bg-carvao/60 px-2 py-3 font-semibold text-marfim/85">
                <I className="h-5 w-5 text-ouro" />
                {txt as string}
              </div>
            );
          })}
        </div>
      )}

      <nav className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Link href="/" className={chip(!cat)}>Todos</Link>
        {categorias.map((c) => (
          <Link key={c.id} href={`/?cat=${c.slug}`} className={chip(cat === c.slug)}>{c.nome}</Link>
        ))}
      </nav>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">{q ? `Resultados para "${q}"` : catAtual ? catAtual.nome : "Novidades na loja"}</h2>
          <p className="text-xs text-cinza">{produtos.length} produto(s) disponível(is)</p>
        </div>
        <div className="flex gap-1 rounded-full border filete bg-carvao p-1 text-[11px] font-semibold">
          {Object.entries(ORDENS).map(([k, v]) => (
            <Link key={k} href={url({ ordem: k })} className={`rounded-full px-3 py-1.5 ${ordem === k ? "bg-ouro text-noite" : "text-cinza"}`}>{v.rotulo}</Link>
          ))}
        </div>
      </div>

      {produtos.length === 0 ? (
        <div className="py-20 text-center text-cinza">
          <IconeSacola className="mx-auto mb-4 h-12 w-12 text-ouro-escuro/60" />
          <p>{q ? `Nada encontrado para "${q}".` : "Novos produtos chegando em breve."}</p>
          {filtrando && <Link href="/" className="mt-3 inline-block text-sm text-ouro-claro underline">Ver todos os produtos</Link>}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {produtos.map((p, i) => <CardProduto key={p.slug} p={p} i={i} />)}
        </div>
      )}

      {vendidos.length > 0 && (
        <section className="mt-14">
          <h2 className="text-center text-lg font-extrabold">Acabaram de sair</h2>
          <p className="mb-4 text-center text-xs text-cinza">Os produtos saem rápido. Entre no nosso grupo de ofertas para ser avisado primeiro.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {vendidos.map((p, i) => <CardProduto key={p.slug} p={p} i={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
