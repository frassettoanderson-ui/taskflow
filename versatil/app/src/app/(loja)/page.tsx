import Link from "next/link";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { expirarPedidos } from "@/lib/pedidos";
import { selecaoCard, type ProdutoCard } from "@/lib/catalogo";
import { soDigitos } from "@/lib/format";
import { CardProduto } from "@/components/CardProduto";
import { Carrossel } from "@/components/Carrossel";
import { BannerCarrossel } from "@/components/BannerCarrossel";
import { CardsDestaque, type CardFixo, type CardPromo } from "@/components/CardsDestaque";
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
    db.produto.findMany({ where: ativo, select: { ...selecaoCard, visualizacoes: true }, take: 300 }),
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

  // cards de destaque (no ML: visto recentemente, também te interessa, conclua sua compra…)
  // os pessoais vêm do navegador; estes são montados no servidor, sem repetir produto
  const usados = new Set<string>();
  const escolher = (lista: ProdutoCard[]) => {
    const p = lista.find((x) => !usados.has(x.id));
    if (p) usados.add(p.id);
    return p;
  };
  const porVisita = [...todos].sort((a, b) => b.visualizacoes - a.visualizacoes);
  const candidatos: [string, ProdutoCard | undefined, string?][] = [
    ["Postado por último", escolher(novidades), "Acabou de chegar"],
    ["Oferta do dia", escolher(ofertas)],
    ["Última unidade", escolher([...novidades, ...todos].filter((p) => p.estoqueDisponivel === 1)), "Corra, é a última!"],
    ["Mais procurados", escolher(porVisita)],
    ["Mais vendidos", escolher([...todos].filter((p) => p.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos))],
    ["Preço baixo", escolher(baratos), "Menor preço da loja"],
  ];
  const fixos: CardFixo[] = candidatos.filter((c): c is [string, ProdutoCard, string?] => Boolean(c[1])).map(([titulo, produto, verde]) => ({ titulo, produto, verde }));
  const promo: CardPromo = zap
    ? { titulo: "Grupo de ofertas no WhatsApp", texto: "Receba as novidades antes de todo mundo.", cta: "Quero entrar", href: `https://wa.me/55${zap}?text=${encodeURIComponent("Olá! Quero entrar no grupo de ofertas da Versátil.")}` }
    : { titulo: "Compre no site, retire na loja", texto: "Pague no Pix ou cartão e busque quando quiser.", cta: "Como funciona", href: "#como-funciona" };

  return (
    <div>
      {/* degradê dourado → cinza atrás do banner, como o amarelo → cinza do ML */}
      <div className="degrade-topo pb-28 md:px-4 md:pb-36 md:pt-2">
        {slides.length > 0 && <BannerCarrossel slides={slides} />}
      </div>

      <div className="mx-auto max-w-[1200px] px-3 md:px-4">
        {/* cards de destaque sobrepostos ao degradê */}
        <div className="-mt-24 md:-mt-32">
          <CardsDestaque fixos={fixos} promo={promo} />
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
