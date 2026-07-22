import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { TelaDeEstoque, type Insumo, type Rentabilidade } from './tela-de-estoque';

export const metadata = { title: 'Estoque' };

export default async function PaginaEstoque() {
  const [insumos, rentabilidade] = await Promise.all([
    apiServer<Insumo[]>('/gestao/insumos'),
    apiServer<Rentabilidade[]>('/gestao/rentabilidade'),
  ]);

  if (insumos.status === 401) redirect('/login');

  if (insumos.status === 403) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Acesso restrito</h1>
          <p className="subtitle">O estoque é para dono e gerente.</p>
        </div>
      </main>
    );
  }

  if (!insumos.ok || !insumos.data) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Backend indisponível</h1>
          <p className="subtitle">Espere alguns segundos e recarregue a página.</p>
        </div>
      </main>
    );
  }

  return <TelaDeEstoque insumosIniciais={insumos.data} rentabilidadeInicial={rentabilidade.data ?? []} />;
}
