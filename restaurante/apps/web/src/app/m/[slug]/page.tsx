import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Cardapio, type MenuPublico } from './cardapio';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

/**
 * Busca o cardápio no backend.
 * Roda no SERVIDOR — por isso a página chega pronta e rápida para o cliente,
 * sem "piscar" carregando, que é o que o CLAUDE.md pede para o cardápio.
 */
async function buscarCardapio(slug: string): Promise<MenuPublico | null> {
  try {
    const res = await fetch(`${API}/api/public/menu/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as MenuPublico;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const menu = await buscarCardapio(slug);
  if (!menu) return { title: 'Cardápio não encontrado' };
  return {
    title: `${menu.brand.name} — Cardápio`,
    description: menu.brand.description ?? undefined,
  };
}

export default async function PaginaCardapio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await buscarCardapio(slug);

  if (!menu) notFound();

  return <Cardapio menu={menu} />;
}
