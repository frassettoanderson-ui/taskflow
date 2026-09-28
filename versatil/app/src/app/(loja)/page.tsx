import Link from "next/link";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { expirarPedidos } from "@/lib/pedidos";
import { selecaoCard, type ProdutoCard } from "@/lib/catalogo";
import { soDigitos } from "@/lib/format";
import { CardProduto } from "@/components/CardProduto";
import { Carrossel } from "@/components/Carrossel";
import { BannerCarrossel } from "@/components/BannerCarrossel";
import { IconeEscudo, IconeLoja, IconePix, IconeSacola, IconeWhats } from "@/components/Icones";
import { FotoProduto } from "@/components/FotoProduto";

export const dynamic = "force-dynamic";

function Secao({ titulo, href, produtos }: { titulo: string; href: string; produtos: ProdutoCard[] }) {
  if (!produtos.length) return null;
  return (
    <section className="cartao mt-6 p-4 md:p-6">
      <div className="mb-4 flex items-baseline gap-4">
        <h2 className="text-[20px] font-semibold md:text-[24px]">{titulo}</h2>
        <Link href={href} className="text-[14px] text-ouro-escuro hover:underline">Ver todos</Link>
      </div>
      <Carrossel>
        {produtos.map((p) => (
          <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[calc((100%-64px)/5)]">
            <CardProduto p={p} compacto />
          </div>
        ))}
      </Carrossel>
    </section>
  );
}

export default async function Home() {
  await expirarPedidos();
  const ativo = { status: "ATIVO" as const };
  const [cfg, novidades, baratos, todos, categorias] = await Promise.all([
    getConfig(),
    db.produto.findMany({ where: ativo, select: selecaoCard, orderBy: { publicadoEm: "desc" }, take: 15 }),
    db.produto.findMany({ where: { ...ativo, precoCents: { lte: 100_00 } }, select: selecaoCard, orderBy: { precoCents: "asc" }, take: 15 }),
    db.produto.findMany({ where: { ...ativo, precoMercadoCents: { not: null } }, select: selecaoCard, take: 200 }),
    db.categoria.findMany({
      where: { produtos: { some: ativo } },
      orderBy: { ordem: "asc" },
      include: { produtos: { where: ativo, take: 1, orderBy: { publicadoEm: "desc" }, select: { fotos: { select: { arquivo: true }, take: 1, orderBy: { ordem: "asc" } } } } },
    }),
  ]);
  const pct = (p: ProdutoCard) => (p.precoMercadoCents ? 1 - p.precoCents / p.precoMercadoCents : 0);
  const ofertas = [...todos].sort((a, b) => pct(b) - pct(a)).slice(0, 15);
  const maxDesc = ofertas[0] ? Math.round(pct(ofertas[0]) * 100) : 0;
  const zap = soDigitos(cfg.loja_whatsapp);
  const fotos = (lista: ProdutoCard[]) => lista.map((p) => p.fotos[0]?.arquivo).filter(Boolean) as string[];

  const slides = [
    { titulo: `Até ${maxDesc || 70}% OFF`, sub: "Produtos novos, de caixa aberta e com pequenas avarias — todos conferidos.", cta: "Ver ofertas", href: "/busca?ordem=desconto", fotos: fotos(ofertas.slice(0, 3)), tema: "escuro" as const },
    { titulo: "Compre no site, retire na loja", sub: "Pague no Pix ou cartão. Pagou, o produto fica separado no seu nome.", cta: "Ver novidades", href: "/busca", fotos: fotos(novidades.slice(0, 3)), tema: "claro" as const },
    { titulo: "Ofertas até R$ 100", sub: "Achados do dia a dia com preço de verdade.", cta: "Aproveitar", href: "/busca?max=100", fotos: fotos(baratos.slice(0, 3)), tema: "escuro" as const },
  ].filter((s) => s.fotos.length);

  const atalhos = [
    { icone: IconePix, titulo: "Pix ou cartão", texto: "Pague como preferir, com segurança.", cta: "Como funciona", href: "#como-funciona" },
    { icone: IconeLoja, titulo: "Retire na loja", texto: cfg.loja_endereco, cta: "Ver endereço", href: "#como-funciona" },
    { icone: IconeEscudo, titulo: "Produtos conferidos", texto: "Testados pela equipe antes de ir para a loja.", cta: "Ver produtos", href: "/busca" },
    { icone: IconeSacola, titulo: "Até R$ 50", texto: "Ofertas baratinhas para aproveitar hoje.", cta: "Mostrar produtos", href: "/busca?max=50" },
    ...(zap ? [{ icone: IconeWhats, titulo: "Grupo de ofertas", texto: "Receba as novidades primeiro no WhatsApp.", cta: "Falar com a loja", href: `https://wa.me/55${zap}` }] : []),
  ];

  return (
    <div>
      {/* degradê dourado → cinza atrás do banner, como o amarelo → cinza do ML */}
      <div className="degrade-topo pb-28 md:px-4 md:pb-36 md:pt-2">
        {slides.length > 0 && <BannerCarrossel slides={slides} />}
      </div>

      <div className="mx-auto max-w-[1200px] px-3 md:px-4">
        {/* cards de atalho sobrepostos ao degradê */}
        <div className="sem-barra -mt-24 flex gap-3 overflow-x-auto pb-1 md:-mt-32 md:grid md:gap-4" style={{ gridTemplateColumns: `repeat(${atalhos.length}, minmax(0, 1fr))` }}>
          {atalhos.map((a) => (
            <Link key={a.titulo} href={a.href} className="cartao flex w-[160px] shrink-0 flex-col items-center p-4 text-center md:w-auto md:p-5">
              <p className="text-[15px] font-semibold md:text-[16px]">{a.titulo}</p>
              <span className="my-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#faf0d2] md:h-16 md:w-16">
                <a.icone className="h-7 w-7 text-ouro-escuro" />
              </span>
              <p className="line-clamp-2 text-[12px] text-cinza md:text-[13px]">{a.texto}</p>
              <span className="botao-secundario mt-3 w-full px-2 py-1.5 text-[12px]">{a.cta}</span>
            </Link>
          ))}
        </div>

        <Secao titulo="Ofertas do dia" href="/busca?ordem=desconto" produtos={ofertas} />
        <Secao titulo="Acabaram de chegar" href="/busca" produtos={novidades} />
        <Secao titulo="Até R$ 100" href="/busca?max=100" produtos={baratos} />

        {categorias.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-4 text-[20px] font-semibold md:text-[24px]">Categorias</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 md:gap-3">
              {categorias.map((c) => (
                <Link key={c.id} href={`/busca?cat=${c.slug}`} className="cartao flex flex-col items-center gap-2 p-3 text-center transition hover:shadow-[0_8px_16px_rgba(0,0,0,0.12)] md:p-4">
                  <span className="h-16 w-16 overflow-hidden rounded-full border border-fio bg-white md:h-20 md:w-20">
                    <FotoProduto arquivo={c.produtos[0]?.fotos[0]?.arquivo} alt={c.nome} miniatura className="h-full w-full !object-contain p-2" />
                  </span>
                  <span className="text-[12px] leading-tight text-marfim/85 md:text-[13px]">{c.nome}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="como-funciona" className="cartao mt-6 grid gap-6 p-6 text-center md:grid-cols-3">
          {[
            ["1", "Escolha e pague", "Pix com aprovação na hora ou cartão de crédito. O produto fica reservado enquanto você paga."],
            ["2", "Receba seu código", "Pagamento aprovado gera um código de retirada na tela — tire um print."],
            ["3", "Retire na loja", `${cfg.loja_endereco} · ${cfg.loja_horario}. Sem prazo para buscar.`],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-faixa text-[16px] font-bold">{n}</span>
              <p className="mt-2 text-[16px] font-semibold">{t}</p>
              <p className="mt-1 text-[13px] text-cinza">{d}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
