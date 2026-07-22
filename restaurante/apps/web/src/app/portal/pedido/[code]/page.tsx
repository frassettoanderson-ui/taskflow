import { notFound } from 'next/navigation';
import { PedidoDoPortal, type Acompanhamento } from './pedido-do-portal';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

export const metadata = { title: 'Seu pedido — Portal' };

export default async function PaginaPedidoDoPortal({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let pedido: Acompanhamento | null = null;
  try {
    const res = await fetch(`${API}/api/portal/pedido/${code}`, { cache: 'no-store' });
    if (res.ok) pedido = await res.json();
  } catch {
    pedido = null;
  }

  if (!pedido) notFound();

  return <PedidoDoPortal inicial={pedido} code={code} />;
}
