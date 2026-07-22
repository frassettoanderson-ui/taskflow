import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Cardapio, type MenuPublico, type RegrasPublicas } from './cardapio';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

// As fotos dos pratos são servidas pelo backend em /uploads — o Next repassa
// esse endereço junto com /api (ver next.config.js).

/**
 * Busca o cardápio no backend, no canal pedido.
 * Roda no SERVIDOR — por isso a página chega pronta e rápida para o cliente,
 * sem "piscar" carregando, que é o que o CLAUDE.md pede para o cardápio.
 */
async function buscarCardapio(slug: string, canal: string): Promise<MenuPublico | null> {
  try {
    const res = await fetch(
      `${API}/api/public/menu/${slug}?canal=${encodeURIComponent(canal)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as MenuPublico;
  } catch {
    return null;
  }
}

/** Horários da semana e área de entrega — vira o rodapé da página. */
async function buscarRegras(slug: string, canal: string): Promise<RegrasPublicas | null> {
  try {
    const res = await fetch(
      `${API}/api/public/menu/${slug}/regras?canal=${encodeURIComponent(canal)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as RegrasPublicas;
  } catch {
    return null;
  }
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ canal?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { canal } = await searchParams;
  const menu = await buscarCardapio(slug, canal ?? 'delivery');
  if (!menu) return { title: 'Cardápio não encontrado' };
  return {
    title: `${menu.brand.name} — ${menu.channelLabel}`,
    description: menu.brand.description ?? undefined,
  };
}

export default async function PaginaCardapio({ params, searchParams }: Props) {
  const { slug } = await params;
  const { canal } = await searchParams;

  const canalAtual = canal ?? 'delivery';
  const [menu, regras] = await Promise.all([
    buscarCardapio(slug, canalAtual),
    buscarRegras(slug, canalAtual),
  ]);

  if (!menu) notFound();

  return <Cardapio menu={menu} canalAtual={canalAtual} regras={regras} />;
}
