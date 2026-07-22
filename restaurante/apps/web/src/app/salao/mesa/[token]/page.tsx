import { redirect, notFound } from 'next/navigation';
import { apiServer } from '@/lib/api';
import type { MenuPublico } from '../../../m/[slug]/cardapio';
import type { EstadoDaMesa } from '../../../mesa/[token]/mesa-cliente';
import { MesaDaEquipe } from './mesa-da-equipe';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

async function publico<T>(caminho: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/api${caminho}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type Me = { user: { name: string; role: string } };

export const metadata = { title: 'Mesa' };

export default async function PaginaMesaDaEquipe({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const me = await apiServer<Me>('/auth/me');
  if (me.status === 401) redirect('/login');

  const estado = await publico<EstadoDaMesa>(`/public/mesa/${token}`);
  if (!estado) notFound();

  const menu = await publico<MenuPublico>(`/public/menu/${estado.marca.slug}?canal=salao`);
  if (!menu) notFound();

  return (
    <MesaDaEquipe
      token={token}
      inicial={estado}
      categorias={menu.categories}
      papel={me.data?.user.role ?? 'WAITER'}
      nome={me.data?.user.name ?? ''}
    />
  );
}
