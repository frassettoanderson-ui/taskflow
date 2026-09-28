import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { expirarPedidos } from "@/lib/pedidos";
import { CardProduto } from "@/components/CardProduto";
import { Martelo } from "@/components/Martelo";

export const dynamic = "force-dynamic";

const selecao = {
  slug: true,
  codigo: true,
  titulo: true,
  condicao: true,
  precoCents: true,
  precoMercadoCents: true,
  estoqueDisponivel: true,
  estoqueReservado: true,
  status: true,
  fotos: { select: { arquivo: true }, orderBy: { ordem: "asc" }, take: 1 },
} satisfies Prisma.ProdutoSelect;

export default async function Vitrine({ searchParams }: PageProps<"/">) {
  await expirarPedidos();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";

  const where: Prisma.ProdutoWhereInput = {
    status: "ATIVO",
    ...(q ? { titulo: { contains: q, mode: "insensitive" } } : {}),
    ...(cat ? { categoria: { slug: cat } } : {}),
  };
  const [produtos, categorias, arrematados] = await Promise.all([
    db.produto.findMany({ where, select: selecao, orderBy: [{ publicadoEm: "desc" }], take: 120 }),
    db.categoria.findMany({ where: { produtos: { some: { status: "ATIVO" } } }, orderBy: { ordem: "asc" } }),
    q || cat
      ? Promise.resolve([])
      : db.produto.findMany({ where: { status: "ESGOTADO" }, select: selecao, orderBy: { ultimaVendaEm: "desc" }, take: 6 }),
  ]);
  const maxDesc = produtos.reduce(
    (m, s) => (s.precoMercadoCents ? Math.max(m, Math.round((1 - s.precoCents / s.precoMercadoCents) * 100)) : m),
    0,
  );

  const chip = (ativo: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${ativo ? "border-ouro bg-ouro/10 text-ouro-claro" : "filete text-cinza hover:text-marfim"}`;

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="entrada pb-6 pt-8 text-center sm:pt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ouro">Preço de arremate, todo dia</p>
        <h1 className="mt-3 text-[2.1rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          Oportunidades <span className="texto-ouro whitespace-nowrap font-serif text-[1.15em] font-normal italic">de hoje</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-cinza">
          Produtos de logística reversa, conferidos pela nossa equipe. {produtos.length} lotes na vitrine
          {maxDesc > 0 && (
            <>
              {" "}
              · até <b className="text-ouro-claro">{maxDesc}% abaixo</b> do mercado
            </>
          )}
          .
        </p>
        <form className="mx-auto mt-6 flex max-w-md gap-2" action="/">
          {cat && <input type="hidden" name="cat" value={cat} />}
          <input name="q" defaultValue={q} placeholder="O que você procura?" className="campo !rounded-full" />
          <button className="botao-ouro shrink-0 rounded-full px-5 text-sm">Buscar</button>
        </form>
      </section>

      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:justify-center">
        <Link href="/" className={chip(!cat)}>
          Tudo
        </Link>
        {categorias.map((c) => (
          <Link key={c.id} href={`/?cat=${c.slug}`} className={chip(cat === c.slug)}>
            {c.nome}
          </Link>
        ))}
      </nav>

      {produtos.length === 0 ? (
        <div className="py-20 text-center text-cinza">
          <Martelo className="mx-auto mb-4 h-14 w-14 text-ouro-escuro/60" />
          <p>{q ? `Nada encontrado para "${q}".` : "Novos lotes chegando em breve."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {produtos.map((p, i) => (
            <CardProduto key={p.slug} p={p} i={i} />
          ))}
        </div>
      )}

      {arrematados.length > 0 && (
        <section className="mt-16">
          <div className="mb-5 flex items-center gap-4">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ouro-escuro/60" />
            <h2 className="font-serif text-2xl italic text-ouro-claro">Arrematados recentemente</h2>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ouro-escuro/60" />
          </div>
          <p className="-mt-3 mb-5 text-center text-xs text-cinza">Quem viu primeiro, levou. Fique de olho no nosso grupo.</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {arrematados.map((p, i) => (
              <CardProduto key={p.slug} p={p} i={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
