import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CardapioDoPortal, type MenuDoPortal } from './cardapio-do-portal';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

async function buscar(slug: string): Promise<MenuDoPortal | null> {
  try {
    const res = await fetch(`${API}/api/portal/marca/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as MenuDoPortal;
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
  const menu = await buscar(slug);
  if (!menu) return { title: 'Restaurante não encontrado' };
  return { title: `${menu.marca.nome} — Portal` };
}

export default async function PaginaMarcaNoPortal({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const menu = await buscar(slug);
  if (!menu) notFound();

  return <CardapioDoPortal menu={menu} slug={slug} />;
}
