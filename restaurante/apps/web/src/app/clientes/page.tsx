import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { TelaDeClientes, type ClienteResumo, type SegmentoContagem } from './tela-de-clientes';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

export const metadata = { title: 'Clientes' };

export default async function PaginaClientes() {
  const [clientes, segmentos, marcas] = await Promise.all([
    apiServer<ClienteResumo[]>('/marketing/clientes'),
    apiServer<SegmentoContagem[]>('/marketing/segmentos'),
    apiServer<MarcaResumo[]>('/brands'),
  ]);

  if (clientes.status === 401) redirect('/login');

  if (clientes.status === 403) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Acesso restrito</h1>
          <p className="subtitle">A base de clientes é visível para dono, gerente e caixa.</p>
        </div>
      </main>
    );
  }

  if (!clientes.ok || !clientes.data) {
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
    <TelaDeClientes
      iniciais={clientes.data}
      segmentosIniciais={segmentos.data ?? []}
      marcas={marcas.data ?? []}
    />
  );
}
