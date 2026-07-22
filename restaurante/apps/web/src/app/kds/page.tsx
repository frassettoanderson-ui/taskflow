import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { TelaDaCozinha, type PedidoKds, type Estacao, type MarcaKds } from './tela-da-cozinha';

export const metadata = { title: 'Cozinha (KDS)' };

export default async function PaginaKds() {
  const [pedidos, estacoes, marcas] = await Promise.all([
    apiServer<PedidoKds[]>('/orders/kds'),
    apiServer<Estacao[]>('/orders/estacoes'),
    apiServer<MarcaKds[]>('/brands'),
  ]);

  if (pedidos.status === 401) redirect('/login');

  if (!pedidos.ok || !pedidos.data) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Backend indisponível</h1>
          <p className="subtitle">Espere alguns segundos e recarregue a página.</p>
        </div>
      </main>
    );
  }

  return (
    <TelaDaCozinha
      iniciais={pedidos.data}
      estacoes={estacoes.data ?? []}
      marcas={marcas.data ?? []}
    />
  );
}
