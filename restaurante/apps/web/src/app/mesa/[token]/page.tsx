import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { MenuPublico } from '../../m/[slug]/cardapio';
import { MesaCliente, type EstadoDaMesa } from './mesa-cliente';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

async function buscar<T>(caminho: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/api${caminho}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const estado = await buscar<EstadoDaMesa>(`/public/mesa/${token}`);
  if (!estado) return { title: 'Mesa não encontrada' };
  return { title: `Mesa ${estado.mesa.numero} — ${estado.marca.name}` };
}

/**
 * A página que abre quando o cliente aponta a câmera para o QR Code da mesa.
 * Sem login, sem cadastro, sem aplicativo.
 */
export default async function PaginaDaMesa({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { token } = await params;
  const { modo } = await searchParams;

  const estado = await buscar<EstadoDaMesa>(`/public/mesa/${token}`);
  if (!estado) notFound();

  // O cardápio da mesa é sempre o do canal SALÃO da marca daquela mesa.
  const menu = await buscar<MenuPublico>(`/public/menu/${estado.marca.slug}?canal=salao`);
  if (!menu) notFound();

  return (
    <MesaCliente
      token={token}
      inicial={estado}
      categorias={menu.categories}
      totem={modo === 'totem'}
    />
  );
}
