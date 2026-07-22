import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { TelaDeRelatorios, type PainelDeVendas } from './tela-de-relatorios';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

export const metadata = { title: 'Relatórios' };

export default async function PaginaRelatorios() {
  const [painel, marcas] = await Promise.all([
    apiServer<PainelDeVendas>('/gestao/relatorios'),
    apiServer<MarcaResumo[]>('/brands'),
  ]);

  if (painel.status === 401) redirect('/login');

  if (painel.status === 403) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Acesso restrito</h1>
          <p className="subtitle">Os relatórios são para dono e gerente.</p>
        </div>
      </main>
    );
  }

  if (!painel.ok || !painel.data) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Backend indisponível</h1>
          <p className="subtitle">Espere alguns segundos e recarregue a página.</p>
        </div>
      </main>
    );
  }

  return <TelaDeRelatorios inicial={painel.data} marcas={marcas.data ?? []} />;
}
