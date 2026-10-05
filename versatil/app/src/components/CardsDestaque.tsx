"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProdutoCard } from "@/lib/catalogo";
import { brl, descontoPct } from "@/lib/format";
import { urlFoto } from "@/lib/uploads-url";
import { useCarrinho } from "./carrinho";
import { Carrossel } from "./Carrossel";
import { FotoProduto } from "./FotoProduto";
import { Preco } from "./Preco";
import { CHAVE_VISTOS } from "./RegistrarVisto";
import { Marca } from "@/components/Marca";

export type CardFixo = { titulo: string; produto: ProdutoCard; verde?: string; cta?: { rotulo: string; href: string } };
export type CardPromo = { titulo: string; texto: string; cta: string; href: string };

const LARGURA = "w-[172px] md:w-[188px]";

function CardBase({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className={`cartao flex h-[312px] shrink-0 snap-start flex-col p-4 text-left ${LARGURA}`}>
      <p className="text-[16px] font-semibold leading-tight">{titulo}</p>
      {children}
    </div>
  );
}

function CardProdutoDestaque({ titulo, produto: p, verde, cta }: CardFixo) {
  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  return (
    <CardBase titulo={titulo}>
      <Link href={`/p/${p.slug}`} className="mt-3 flex flex-1 flex-col">
        <div className="mx-auto h-[112px] w-[112px]">
          <FotoProduto arquivo={p.fotos[0]?.arquivo} alt={p.titulo} miniatura className="h-full w-full !object-contain" />
        </div>
        <p className="mt-3 line-clamp-2 text-[14px] leading-[1.3] text-marfim/90">{p.titulo}</p>
        <div className="mt-1.5">
          {p.precoMercadoCents && p.precoMercadoCents > p.precoCents && <s className="block text-[11px] leading-none text-cinza">{brl(p.precoMercadoCents)}</s>}
          <span className="flex flex-wrap items-center gap-x-1.5">
            <Preco cents={p.precoCents} tamanho={20} />
            {desc > 0 && <span className="text-[12px] font-normal text-jade">{desc}% OFF</span>}
          </span>
        </div>
        {!cta && <p className="mt-1 text-[13px] font-semibold text-jade">{verde ?? "Retire na loja"}</p>}
      </Link>
      {cta && (
        <Link href={cta.href} className="botao-secundario mt-2 block py-1.5 text-center text-[13px]">
          {cta.rotulo}
        </Link>
      )}
    </CardBase>
  );
}

function CardCarrinho({ fotos, qtd }: { fotos: (string | null | undefined)[]; qtd: number }) {
  return (
    <CardBase titulo="Compre seu carrinho">
      <Link href="/carrinho" className="mt-3 grid flex-1 grid-cols-2 gap-1.5">
        {fotos.slice(0, 4).map((f, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-[4px] bg-white">
            {f ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlFoto(f, true)} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full bg-grafite" />
            )}
            {i === 3 && qtd > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[15px] font-semibold text-white">+{qtd - 3}</span>}
          </div>
        ))}
      </Link>
      <Link href="/carrinho" className="botao-secundario mt-2 block py-1.5 text-center text-[13px]">
        Ir para o carrinho
      </Link>
    </CardBase>
  );
}

function CardEscuro({ titulo, texto, cta, href }: CardPromo) {
  return (
    <Link href={href} className={`relative flex h-[312px] shrink-0 snap-start flex-col overflow-hidden rounded-[6px] bg-noite p-4 text-left text-white ${LARGURA}`}>
      <span className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-ouro/25 blur-2xl" />
      <Marca className="relative self-start text-[18px]" />
      <p className="relative mt-auto text-[20px] font-bold leading-tight">{titulo}</p>
      <p className="relative mt-2 text-[13px] text-white/70">{texto}</p>
      <span className="relative mt-4 block rounded-[6px] bg-ouro py-1.5 text-center text-[13px] font-semibold text-noite">{cta}</span>
    </Link>
  );
}

/** Fileira de cards personalizados, no formato dos cards do topo da home do Mercado Livre. */
export function CardsDestaque({ fixos, promo }: { fixos: CardFixo[]; promo?: CardPromo }) {
  const { itens, pronto } = useCarrinho();
  const [pessoais, setPessoais] = useState<{ visto: ProdutoCard | null; interessa: ProdutoCard | null }>({ visto: null, interessa: null });

  useEffect(() => {
    let vistos: string[] = [];
    try {
      vistos = JSON.parse(localStorage.getItem(CHAVE_VISTOS) || "[]");
    } catch {}
    if (!vistos.length) return;
    fetch(`/api/vitrine?vistos=${vistos.join(",")}`)
      .then((r) => r.json())
      .then(setPessoais)
      .catch(() => {});
  }, []);

  const cards: React.ReactNode[] = [];
  if (pessoais.visto) cards.push(<CardProdutoDestaque key="visto" titulo="Visto recentemente" produto={pessoais.visto} />);
  if (pessoais.interessa) cards.push(<CardProdutoDestaque key="interessa" titulo="Também te interessa" produto={pessoais.interessa} />);
  if (pronto && itens.length) {
    const i = itens[0];
    cards.push(
      <CardProdutoDestaque
        key="conclua"
        titulo="Conclua sua compra"
        produto={{ id: i.produtoId, slug: i.slug, titulo: i.titulo, precoCents: i.precoCents, precoMercadoCents: null, fotos: i.foto ? [{ arquivo: i.foto }] : [] } as unknown as ProdutoCard}
        cta={{ rotulo: "Concluir compra", href: "/checkout" }}
      />,
    );
    if (itens.length > 1) cards.push(<CardCarrinho key="carrinho" fotos={itens.map((x) => x.foto)} qtd={itens.length} />);
  }
  for (const f of fixos) cards.push(<CardProdutoDestaque key={f.titulo} {...f} />);
  if (promo) cards.push(<CardEscuro key="promo" {...promo} />);

  return <Carrossel chave={cards.length}>{cards}</Carrossel>;
}
