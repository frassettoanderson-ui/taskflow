import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { TelaDeCadastro } from './tela-de-cadastro';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

export const metadata = { title: 'Cadastro' };

type Me = { user: { name: string; role: string } };

export default async function PaginaAdmin() {
  const [marcas, me] = await Promise.all([
    apiServer<MarcaResumo[]>('/brands'),
    apiServer<Me>('/auth/me'),
  ]);

  if (marcas.status === 401) redirect('/login');

  if (marcas.status === 403) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Acesso restrito</h1>
          <p className="subtitle">O cadastro é para dono e gerente.</p>
        </div>
      </main>
    );
  }

  if (!marcas.ok || !marcas.data) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Backend indisponível</h1>
          <p className="subtitle">Espere alguns segundos e recarregue a página.</p>
        </div>
      </main>
    );
  }

  return <TelaDeCadastro marcasIniciais={marcas.data} papel={me.data?.user.role ?? 'MANAGER'} />;
}
