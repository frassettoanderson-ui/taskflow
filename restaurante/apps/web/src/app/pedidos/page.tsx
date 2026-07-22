import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { PainelDePedidos, type PedidoDoPainel, type MarcaResumo } from './painel-de-pedidos';

export const metadata = { title: 'Pedidos' };

export default async function PaginaPedidos() {
  const [pedidos, marcas] = await Promise.all([
    apiServer<PedidoDoPainel[]>('/orders?limite=100'),
    apiServer<MarcaResumo[]>('/brands'),
  ]);

  if (pedidos.status === 401 || marcas.status === 401) redirect('/login');

  if (!pedidos.ok || !pedidos.data || !marcas.data) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Backend indisponível</h1>
          <p className="subtitle">Espere alguns segundos e recarregue a página.</p>
        </div>
      </main>
    );
  }

  return <PainelDePedidos iniciais={pedidos.data} marcas={marcas.data} />;
}
