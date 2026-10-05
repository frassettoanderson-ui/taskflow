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
import { Favoritar } from "@/components/Favoritar";
import { RegistrarVisto } from "@/components/RegistrarVisto";
import { IconeEscudo, IconePix, IconeWhats } from "@/components/Icones";
import { BotoesCompra } from "./BotoesCompra";
import { Galeria } from "./Galeria";
import { MARCA } from "@/lib/marca";

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
  const descricao = `${CONDICOES[p.condicao].rotulo}${desc ? ` · ${desc}% OFF` : ""}. Pague no Pix ou cartão e retire na loja ${MARCA.nome}.`;
  const img = p.fotos[0] ? urlFoto(p.fotos[0].arquivo) : "/icone-512.png";
  return { title: titulo, description: descricao, openGraph: { title: titulo, description: descricao, images: [img], type: "website" } };
}

const Icone = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

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

  const [cfg, mesmaCategoria, somaVendas] = await Promise.all([
    getConfig(),
    db.produto.findMany({
      where: { status: "ATIVO", id: { not: p.id }, ...(p.categoriaId ? { categoriaId: p.categoriaId } : {}) },
      select: selecaoCard,
      orderBy: { publicadoEm: "desc" },
      take: 10,
    }),
    db.produto.aggregate({ _sum: { vendidos: true } }),
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

  const vendasLoja = somaVendas._sum.vendidos ?? 0;
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
  const ficha = (Array.isArray(p.fichaTecnica) ? (p.fichaTecnica as { nome: string; valor: string }[]) : []).filter((f) => f?.nome && f?.valor);
  const naFicha = new Set(ficha.map((f) => f.nome.toLowerCase()));
  const caracteristicas: [string, string][] = [
    ...(naFicha.has("marca") ? [] : ([["Marca", p.marca ?? "—"]] as [string, string][])),
    ["Código / SKU", p.sku ?? "—"],
    ["Condição", cond.rotulo],
    ["Categoria", p.categoria?.nome ?? "—"],
    ...(aplicacao.length ? ([["Aplicação", aplicacao.join(", ")]] as [string, string][]) : []),
    ...ficha.map((f) => [f.nome, f.valor] as [string, string]),
  ];
  const linkPublico = `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/p/${p.slug}`;
  const zap = soDigitos(cfg.loja_whatsapp);

  return (
    <div className="mx-auto max-w-[1200px] pb-24 md:px-4 md:pb-8 md:pt-4">
      <RegistrarVisto id={p.id} />
      <div className="bg-white md:rounded-[6px] md:shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
        {/* barra superior (padrão ML): voltar + trilha à esquerda, compartilhar à direita */}
        <div className="flex items-center justify-between gap-3 border-b border-fio bg-[#f7f7f7] px-4 py-2.5 text-[13px] md:rounded-t-[6px] md:px-6">
          <nav className="flex min-w-0 items-center gap-2 text-ouro-escuro">
            <Link href="/busca" className="shrink-0 hover:underline">Voltar</Link>
            <span className="text-[#ccc]">|</span>
            {p.categoria && (
              <>
                <Link href={`/busca?cat=${p.categoria.slug}`} className="shrink-0 hover:underline">{p.categoria.nome}</Link>
                <span className="text-cinza">›</span>
              </>
            )}
            <span className="truncate text-cinza">{p.titulo}</span>
          </nav>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${p.titulo} por ${brl(p.precoCents)} na ${MARCA.nome}: ${linkPublico}`)}`}
            target="_blank"
            className="flex shrink-0 items-center gap-1.5 text-ouro-escuro hover:underline"
          >
            <IconeWhats className="h-4 w-4 text-jade" /> Compartilhar
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 md:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_310px]">
          {/* coluna 1: galeria com fotos e vídeo */}
          <Galeria fotos={p.fotos} video={p.videoUrl} titulo={p.titulo} apagada={esgotado} />

          {/* coluna 2: informações */}
          <div className="px-4 md:px-0">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] text-cinza">
                {cond.rotulo}
                {p.vendidos > 0 && ` | +${p.vendidos} vendido${p.vendidos > 1 ? "s" : ""}`}
              </p>
              <Favoritar id={p.id} />
            </div>
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
                {desc > 0 && <span className="rounded-[3px] bg-jade px-1.5 py-0.5 text-[14px] font-semibold text-white">{desc}% OFF</span>}
              </div>
              <p className="mt-1 text-[14px] text-jade">à vista no Pix ou no cartão de crédito</p>
              <details className="mt-1 text-[14px]">
                <summary className="cursor-pointer list-none text-ouro-escuro hover:underline">Ver os meios de pagamento</summary>
                <div className="mt-2 rounded-[6px] border border-fio p-3 text-[13px] text-marfim/85">
                  <p className="flex items-center gap-2">
                    <IconePix className="h-4 w-4 text-jade" /> <b className="font-semibold">Pix</b> — aprovação na hora, com QR Code ou copia e cola.
                  </p>
                  <p className="mt-1.5 flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ouro-escuro" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>
                    <b className="font-semibold">Cartão de crédito</b> — Visa, Mastercard, Elo, Hipercard e outros.
                  </p>
                  <p className="mt-2 text-[12px] text-cinza">Pagamento processado com segurança pelo Asaas. Na loja física também aceitamos dinheiro.</p>
                </div>
              </details>
            </div>

            <div className="mt-6">
              <p className="text-[16px] font-semibold">O que você precisa saber sobre este produto</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] text-marfim/85 marker:text-cinza">
                {saber.map((s) => <li key={s}>{s}</li>)}
              </ul>
              <a href="#caracteristicas" className="mt-3 inline-block text-[14px] text-ouro-escuro hover:underline">Ver características</a>
            </div>
          </div>

          {/* coluna 3: caixa de compra (vai para baixo das informações em telas médias) */}
          <aside className="mx-4 rounded-[6px] border border-fio p-5 md:col-span-2 md:mx-0 lg:col-span-1 lg:self-start">
            <span className="inline-block rounded-[3px] bg-jade px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">Retirada grátis na loja</span>
            <p className="mt-2 text-[15px]">
              Retire em <b className="font-semibold">{cfg.loja_cidade}</b>
            </p>
            <p className="text-[13px] text-cinza">{cfg.loja_endereco} · {cfg.loja_horario}</p>
            <p className="text-[13px] text-jade">Pagou, já fica separado no seu nome — sem prazo para buscar.</p>

            <p className="mt-5 text-[16px] font-semibold">
              {esgotado ? "Produto esgotado" : reservado ? "Reservado no momento" : p.estoqueDisponivel === 1 ? "Última unidade disponível!" : "Estoque disponível"}
            </p>
            {reservado && <p className="mt-1 text-[13px] text-cinza">Outra pessoa está pagando por este item. Se não concluir, ele volta em poucos minutos.</p>}

            <BotoesCompra
              produto={{ produtoId: p.id, slug: p.slug, titulo: p.titulo, precoCents: p.precoCents, foto: p.fotos[0]?.arquivo ?? null, max: p.estoqueDisponivel }}
              disponivel={disponivel}
            />

            {/* vendedor (no ML: "Loja oficial ...") */}
            <div className="mt-6 flex items-center gap-3 border-t border-fio pt-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-noite">
                <span className="bg-gradient-to-b from-ouro-claro to-ouro bg-clip-text text-[17px] font-black text-transparent">L3</span>
              </span>
              <div className="text-[13px]">
                <p>
                  Loja oficial <b className="font-semibold text-ouro-escuro">{MARCA.nome}</b>{" "}
                  <svg viewBox="0 0 24 24" className="inline h-4 w-4 align-[-3px] text-[#3483fa]" fill="currentColor" aria-label="loja verificada">
                    <path d="m12 2 2.4 2.2 3.2-.4.9 3.1 2.9 1.5-1.2 3 1.2 3-2.9 1.5-.9 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-.9-3.1-2.9-1.5 1.2-3-1.2-3 2.9-1.5.9-3.1 3.2.4Z" />
                    <path d="m8.5 12 2.3 2.3 4.7-4.6" stroke="#fff" strokeWidth="2" fill="none" />
                  </svg>
                </p>
                <p className="text-cinza">
                  {cfg.loja_cidade}
                  {vendasLoja > 0 ? ` · +${vendasLoja} vendas` : ""}
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-3 text-[13px] text-cinza">
              <li className="flex gap-2.5">
                <Icone d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                <span><b className="font-semibold text-ouro-escuro">Devolução:</b> 7 dias para arrependimento em compras online.</span>
              </li>
              <li className="flex gap-2.5">
                <IconeEscudo className="h-5 w-5 shrink-0" />
                <span><b className="font-semibold text-ouro-escuro">Compra garantida.</b> Pagamento seguro e produto reservado na hora.</span>
              </li>
              <li className="flex gap-2.5">
                <Icone d="M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-3-.5-1.5 7L12 18l4.5 2.5-1.5-7" />
                <span>Produto <b className="font-semibold text-ouro-escuro">conferido</b> pela nossa equipe antes de ir para a loja.</span>
              </li>
              <li className="pt-1">
                <Favoritar id={p.id} comTexto />
              </li>
            </ul>
            {zap && (
              <a
                href={`https://wa.me/55${zap}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre: ${p.titulo} (${linkPublico})`)}`}
                target="_blank"
                className="mt-5 flex items-center justify-center gap-2 rounded-[6px] border border-jade py-2.5 text-[14px] font-semibold text-jade hover:bg-jade/5"
              >
                <IconeWhats className="h-4 w-4" /> Tirar dúvida no WhatsApp
              </a>
            )}
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

        <section id="caracteristicas" className="scroll-mt-4 border-t border-fio px-4 py-6 md:px-6">
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
