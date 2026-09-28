import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { expirarPedidos } from "@/lib/pedidos";
import { getConfig } from "@/lib/config";
import { brl, CONDICOES, descontoPct, soDigitos } from "@/lib/format";
import { urlFoto } from "@/lib/uploads-url";
import { CardProduto } from "@/components/CardProduto";
import { IconeCheck, IconeLoja, IconePix, IconeWhats } from "@/components/Icones";
import { BotoesCompra } from "./BotoesCompra";
import { Galeria } from "./Galeria";

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
  const descricao = `${CONDICOES[p.condicao].rotulo}${desc ? ` · ${desc}% abaixo do mercado` : ""}. Pague no Pix ou cartão e retire na loja Versátil.`;
  const img = p.fotos[0] ? urlFoto(p.fotos[0].arquivo) : "/icone-512.png";
  return { title: titulo, description: descricao, openGraph: { title: titulo, description: descricao, images: [img], type: "website" } };
}

export default async function PaginaProduto({ params, searchParams }: PageProps<"/p/[slug]">) {
  await expirarPedidos();
  const p = await buscar((await params).slug);
  if (!p || p.status === "RASCUNHO" || p.status === "ARQUIVADO") notFound();
  const g = Number((await searchParams).g) || 0;

  after(async () => {
    await db.produto.update({ where: { id: p.id }, data: { visualizacoes: { increment: 1 } } }).catch(() => {});
    if (g) {
      const grupo = await db.grupo.findUnique({ where: { numero: g }, select: { id: true } });
      await db.clique.create({ data: { produtoId: p.id, grupoId: grupo?.id ?? null } }).catch(() => {});
    }
  });

  const incluirFoto = { fotos: { select: { arquivo: true }, orderBy: { ordem: "asc" as const }, take: 1 } };
  const [cfg, mesmaCategoria] = await Promise.all([
    getConfig(),
    db.produto.findMany({
      where: { status: "ATIVO", id: { not: p.id }, ...(p.categoriaId ? { categoriaId: p.categoriaId } : {}) },
      include: incluirFoto,
      orderBy: { publicadoEm: "desc" },
      take: 4,
    }),
  ]);
  // completa com outros produtos quando a categoria tem poucos
  const relacionados =
    mesmaCategoria.length >= 4
      ? mesmaCategoria
      : [
          ...mesmaCategoria,
          ...(await db.produto.findMany({
            where: { status: "ATIVO", id: { notIn: [p.id, ...mesmaCategoria.map((m) => m.id)] } },
            include: incluirFoto,
            orderBy: { publicadoEm: "desc" },
            take: 4 - mesmaCategoria.length,
          })),
        ];

  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  const esgotado = p.status === "ESGOTADO";
  const reservado = !esgotado && p.estoqueDisponivel === 0 && p.estoqueReservado > 0;
  const cond = CONDICOES[p.condicao];
  const aplicacao = p.aplicacao.split("\n").map((s) => s.trim()).filter(Boolean);
  const specs: [string, string][] = [
    ["Condição", cond.rotulo],
    ...(p.marca ? ([["Marca", p.marca]] as [string, string][]) : []),
    ...(p.sku ? ([["Código / SKU", p.sku]] as [string, string][]) : []),
    ...(p.categoria ? ([["Categoria", p.categoria.nome]] as [string, string][]) : []),
    ["Disponibilidade", esgotado ? "Esgotado" : reservado ? "Reservado" : `${p.estoqueDisponivel} unidade(s)`],
  ];
  const linkPublico = `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/p/${p.slug}`;
  const zap = soDigitos(cfg.loja_whatsapp);

  return (
    <div className="mx-auto max-w-6xl pb-28 md:px-4 md:pb-10">
      <nav className="hidden px-4 py-4 text-xs text-cinza md:block md:px-0">
        <Link href="/" className="hover:text-marfim">Início</Link>
        {p.categoria && (
          <>
            {" › "}
            <Link href={`/?cat=${p.categoria.slug}`} className="hover:text-marfim">{p.categoria.nome}</Link>
          </>
        )}
        {" › "}
        <span className="text-marfim/80">{p.titulo}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:gap-10">
        <Galeria fotos={p.fotos} titulo={p.titulo} apagada={esgotado} />

        <div className="flex flex-col px-4 md:px-0">
          <div className="flex flex-wrap items-center justify-center gap-2 text-center md:justify-start">
            <span className="rounded-full bg-ouro/15 px-3 py-1 text-[11px] font-bold text-ouro-claro">{cond.rotulo}</span>
            {p.marca && <span className="rounded-full bg-grafite px-3 py-1 text-[11px] font-semibold text-marfim/80">{p.marca}</span>}
          </div>
          <h1 className="mt-3 text-center text-2xl font-extrabold leading-tight sm:text-3xl md:text-left">{p.titulo}</h1>
          {p.sku && <p className="mt-1 text-center text-xs text-cinza md:text-left">Código/SKU: {p.sku}</p>}

          <div className="mt-5 rounded-2xl border filete bg-carvao p-5 text-center md:text-left">
            {p.precoMercadoCents && p.precoMercadoCents > p.precoCents && (
              <p className="text-sm text-cinza">
                Preço de mercado: <span className="line-through">{brl(p.precoMercadoCents)}</span>
                {desc > 0 && <span className="ml-2 rounded-full bg-ouro px-2 py-0.5 text-[11px] font-extrabold text-noite">-{desc}%</span>}
              </p>
            )}
            <p className="texto-ouro mt-1 text-4xl font-extrabold tracking-tight">{brl(p.precoCents)}</p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-cinza md:justify-start">
              <IconePix className="h-3.5 w-3.5 text-ouro" /> no Pix ou cartão de crédito
            </p>
            {!esgotado && !reservado && (
              <p className={`mt-3 text-xs font-bold ${p.estoqueDisponivel === 1 ? "text-rubi" : "text-jade"}`}>
                {p.estoqueDisponivel === 1 ? "Última unidade disponível" : `Em estoque: ${p.estoqueDisponivel} unidades`}
              </p>
            )}
            {reservado && (
              <p className="mt-3 text-sm text-ouro-claro">Outra pessoa está finalizando a compra deste produto. Se o pagamento não for concluído, ele volta a ficar disponível em poucos minutos.</p>
            )}
            {esgotado && <p className="mt-3 text-sm font-semibold text-rubi">Produto esgotado.</p>}
          </div>

          <BotoesCompra
            produto={{ produtoId: p.id, slug: p.slug, titulo: p.titulo, precoCents: p.precoCents, foto: p.fotos[0]?.arquivo ?? null, max: p.estoqueDisponivel }}
            disponivel={!esgotado && !reservado && p.estoqueDisponivel > 0}
          />

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-ouro-escuro/50 p-4 text-sm">
            <IconeLoja className="mt-0.5 h-5 w-5 shrink-0 text-ouro" />
            <div>
              <p className="font-semibold">Retire na loja</p>
              <p className="text-xs text-cinza">{cfg.loja_endereco} · {cfg.loja_horario}. Pagou, o produto fica separado no seu nome — sem prazo para buscar.</p>
            </div>
          </div>

          <div className="mt-3 flex justify-center gap-4 text-xs md:justify-start">
            <a href={`https://wa.me/?text=${encodeURIComponent(`${p.titulo} por ${brl(p.precoCents)} na Versátil: ${linkPublico}`)}`} target="_blank" className="inline-flex items-center gap-1.5 text-marfim/80 hover:text-marfim">
              <IconeWhats className="h-4 w-4 text-jade" /> Compartilhar
            </a>
            {zap && (
              <a href={`https://wa.me/55${zap}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre: ${p.titulo} (${linkPublico})`)}`} target="_blank" className="inline-flex items-center gap-1.5 text-marfim/80 hover:text-marfim">
                <IconeWhats className="h-4 w-4 text-jade" /> Tirar dúvida
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 px-4 md:grid-cols-2 md:px-0">
        {aplicacao.length > 0 && (
          <section className="rounded-2xl border filete bg-carvao/60 p-5">
            <h2 className="mb-3 text-center font-bold md:text-left">Aplicação / compatibilidade</h2>
            <ul className="space-y-2 text-sm">
              {aplicacao.map((a) => (
                <li key={a} className="flex items-start gap-2">
                  <IconeCheck className="mt-0.5 h-4 w-4 shrink-0 text-jade" />
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="rounded-2xl border filete bg-carvao/60 p-5">
          <h2 className="mb-3 text-center font-bold md:text-left">Especificações</h2>
          <dl className="divide-y divide-fio text-sm">
            {specs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="text-cinza">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-cinza">{cond.dica}.</p>
        </section>
        {p.descricao && (
          <section className="rounded-2xl border filete bg-carvao/60 p-5 md:col-span-2">
            <h2 className="mb-3 text-center font-bold md:text-left">Descrição</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-marfim/85">{p.descricao}</p>
          </section>
        )}
      </div>

      {relacionados.length > 0 && (
        <section className="mt-12 px-4 md:px-0">
          <h2 className="mb-4 text-center text-lg font-extrabold md:text-left">Você também pode gostar</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {relacionados.map((r, i) => <CardProduto key={r.id} p={r} i={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
