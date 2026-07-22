import { notFound } from 'next/navigation';
import { Avaliacao, type Pesquisa } from './avaliacao';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

export const metadata = { title: 'Como foi seu pedido?' };

export default async function PaginaAvaliar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let pesquisa: Pesquisa | null = null;
  try {
    const res = await fetch(`${API}/api/public/avaliar/${token}`, { cache: 'no-store' });
    if (res.ok) pesquisa = await res.json();
  } catch {
    pesquisa = null;
  }

  if (!pesquisa) notFound();

  return <Avaliacao token={token} inicial={pesquisa} />;
}
