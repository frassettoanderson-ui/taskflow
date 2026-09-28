import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { expirarPedidos } from "@/lib/pedidos";
import { getConfig } from "@/lib/config";
import { selecaoCard } from "@/lib/catalogo";
import { brl, CONDICOES, descontoPct, soDigitos } from "@/lib/format";
import { urlFoto } from "@/lib/uploads-url";
import { CardProduto } from "@/components/CardProduto";
import { Carrossel } from "@/components/Carrossel";
import { Preco } from "@/components/Preco";
import { IconeEscudo, IconeLoja, IconePix, IconeWhats } from "@/components/Icones";
import { BotoesCompra } from "./BotoesCompra";
import { RegistrarVisto } from "@/components/RegistrarVisto";
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
  const descricao = `${CONDICOES[p.condicao].rotulo}${desc ? ` · ${desc}% OFF` : ""}. Pague no Pix ou cartão e retire na loja Versátil.`;
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

  const [cfg, mesmaCategoria] = await Promise.all([
    getConfig(),
    db.produto.findMany({
      where: { status: "ATIVO", id: { not: p.id }, ...(p.categoriaId ? { categoriaId: p.categoriaId } : {}) },
      select: selecaoCard,
      orderBy: { publicadoEm: "desc" },
      take: 10,
    }),
  ]);
  const relacionados =
    mesmaCategoria.length >= 5
      ? mesmaCategoria
      : [
          ...mesmaCategoria,
          ...(await db.produto.findMany({
            where: { status: "ATIVO", id: { notIn: [p.id, ...mesmaCategoria.map((m) => m.id)] } },
            select: selecaoCard,
            orderBy: { publicadoEm: "desc" },
            take: 10 - mesmaCategoria.length,
          })),
        ];

  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  const esgotado = p.status === "ESGOTADO";
  const reservado = !esgotado && p.estoqueDisponivel === 0 && p.estoqueReservado > 0;
  const disponivel = !esgotado && !reservado && p.estoqueDisponivel > 0;
  const cond = CONDICOES[p.condicao];
  const aplicacao = p.aplicacao.split("\n").map((s) => s.trim()).filter(Boolean);
  const saber = [
    `Condição: ${cond.rotulo} — ${cond.dica.toLowerCase()}.`,
    ...aplicacao.map((a) => `Compatível com ${a}.`),
    ...(p.marca ? [`Marca: ${p.marca}.`] : []),
    ...(p.sku ? [`Código/SKU: ${p.sku}.`] : []),
  ];
  const caracteristicas: [string, string][] = [
    ["Marca", p.marca ?? "—"],
    ["Código / SKU", p.sku ?? "—"],
    ["Condição", cond.rotulo],
    ["Categoria", p.categoria?.nome ?? "—"],
    ...(aplicacao.length ? ([["Aplicação", aplicacao.join(", ")]] as [string, string][]) : []),
  ];
  const linkPublico = `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/p/${p.slug}`;
  const zap = soDigitos(cfg.loja_whatsapp);

  return (
    <div className="mx-auto max-w-[1200px] pb-24 md:px-4 md:pb-8">
      <RegistrarVisto id={p.id} />
      <nav className="px-3 py-3 text-[13px] text-cinza md:px-0">
        <Link href="/busca" className="text-ouro-escuro hover:underline">Voltar à lista</Link>
        <span className="mx-2">|</span>
        {p.categoria ? (
          <Link href={`/busca?cat=${p.categoria.slug}`} className="text-ouro-escuro hover:underline">{p.categoria.nome}</Link>
        ) : (
          <span>Produtos</span>
        )}
      </nav>

      <div className="bg-white md:rounded-[6px] md:shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 md:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_310px]">
          {/* coluna 1: galeria */}
          <Galeria fotos={p.fotos} titulo={p.titulo} apagada={esgotado} />

          {/* coluna 2: informações */}
          <div className="px-4 md:px-0">
            <p className="text-[13px] text-cinza">
              {cond.rotulo}
              {p.vendidos > 0 && ` | +${p.vendidos} vendido${p.vendidos > 1 ? "s" : ""}`}
            </p>
            <h1 className="mt-1 text-[22px] font-semibold leading-tight text-marfim">{p.titulo}</h1>
            {p.marca && (
              <Link href={`/busca?q=${encodeURIComponent(p.marca)}`} className="mt-1 inline-block text-[13px] text-ouro-escuro hover:underline">
                Ver mais produtos {p.marca}
              </Link>
            )}

            <div className="mt-4">
              {p.precoMercadoCents && p.precoMercadoCents > p.precoCents && <s className="text-[16px] text-cinza">{brl(p.precoMercadoCents)}</s>}
              <div className="flex flex-wrap items-center gap-x-3">
                <Preco cents={p.precoCents} tamanho={36} />
                {desc > 0 && <span className="text-[18px] font-normal text-jade">{desc}% OFF</span>}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[14px] text-marfim/80">
                <IconePix className="h-4 w-4 text-jade" /> no <b className="font-semibold">Pix</b> ou <b className="font-semibold">cartão de crédito</b>
              </p>
            </div>

            <div className="mt-6">
              <p className="text-[16px] font-semibold">O que você precisa saber sobre este produto</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] text-marfim/85 marker:text-cinza">
                {saber.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          </div>

          {/* coluna 3: caixa de compra (vai para baixo das informações em telas médias) */}
          <aside className="mx-4 rounded-[6px] border border-fio p-5 md:col-span-2 md:mx-0 lg:col-span-1 lg:self-start">
            <p className="flex items-center gap-2 text-[16px] font-semibold text-jade">
              <IconeLoja className="h-5 w-5" /> Retire grátis na loja
            </p>
            <p className="mt-1 text-[13px] text-cinza">{cfg.loja_endereco} · {cfg.loja_horario}. Sem prazo para buscar.</p>

            <p className="mt-5 text-[16px] font-semibold">
              {esgotado ? "Produto esgotado" : reservado ? "Reservado no momento" : p.estoqueDisponivel === 1 ? "Última unidade disponível!" : "Estoque disponível"}
            </p>
            {reservado && <p className="mt-1 text-[13px] text-cinza">Outra pessoa está pagando por este item. Se não concluir, ele volta em poucos minutos.</p>}

            <BotoesCompra
              produto={{ produtoId: p.id, slug: p.slug, titulo: p.titulo, precoCents: p.precoCents, foto: p.fotos[0]?.arquivo ?? null, max: p.estoqueDisponivel }}
              disponivel={disponivel}
            />

            <ul className="mt-6 space-y-3 text-[13px] text-cinza">
              <li className="flex gap-2">
                <IconeEscudo className="h-5 w-5 shrink-0 text-cinza" />
                <span><b className="font-semibold text-ouro-escuro">Compra garantida.</b> Pagamento seguro e 7 dias para arrependimento em compras online.</span>
              </li>
              <li className="flex gap-2">
                <IconePix className="h-5 w-5 shrink-0 text-cinza" />
                <span>Pagou, o produto é reservado no seu nome e você recebe o código de retirada na hora.</span>
              </li>
            </ul>
            <div className="mt-5 flex justify-center gap-5 border-t border-fio pt-4 text-[13px]">
              <a href={`https://wa.me/?text=${encodeURIComponent(`${p.titulo} por ${brl(p.precoCents)} na Versátil: ${linkPublico}`)}`} target="_blank" className="inline-flex items-center gap-1.5 text-ouro-escuro hover:underline">
                <IconeWhats className="h-4 w-4 text-jade" /> Compartilhar
              </a>
              {zap && (
                <a href={`https://wa.me/55${zap}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre: ${p.titulo} (${linkPublico})`)}`} target="_blank" className="inline-flex items-center gap-1.5 text-ouro-escuro hover:underline">
                  <IconeWhats className="h-4 w-4 text-jade" /> Perguntar
                </a>
              )}
            </div>
          </aside>
        </div>

        {relacionados.length > 0 && (
          <section className="border-t border-fio px-4 py-6 md:px-6">
            <h2 className="mb-4 text-[20px] font-semibold md:text-[24px]">Produtos relacionados</h2>
            <Carrossel>
              {relacionados.map((r) => (
                <div key={r.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[calc((100%-64px)/5)]">
                  <CardProduto p={r} compacto />
                </div>
              ))}
            </Carrossel>
          </section>
        )}

        <section className="border-t border-fio px-4 py-6 md:px-6">
          <h2 className="mb-4 text-[20px] font-semibold md:text-[24px]">Características do produto</h2>
          <table className="w-full max-w-2xl overflow-hidden rounded-[6px] text-[14px]">
            <tbody>
              {caracteristicas.map(([k, v], i) => (
                <tr key={k} className={i % 2 ? "bg-white" : "bg-grafite"}>
                  <th className="w-[38%] px-4 py-3 text-left font-semibold">{k}</th>
                  <td className="px-4 py-3 text-marfim/85">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {p.descricao && (
          <section className="border-t border-fio px-4 py-6 md:px-6">
            <h2 className="mb-4 text-[20px] font-semibold md:text-[24px]">Descrição</h2>
            <p className="max-w-3xl whitespace-pre-line text-[16px] leading-relaxed text-cinza">{p.descricao}</p>
          </section>
        )}
      </div>
    </div>
  );
}
