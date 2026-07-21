import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Acompanhamento, type PedidoPublico } from './acompanhamento';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

async function buscarPedido(code: string): Promise<PedidoPublico | null> {
  try {
    const res = await fetch(`${API}/api/public/orders/${code}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as PedidoPublico;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: `Pedido ${code.toUpperCase()}` };
}

export default async function PaginaPedido({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const pedido = await buscarPedido(code);

  if (!pedido) notFound();

  return <Acompanhamento inicial={pedido} />;
}
