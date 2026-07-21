import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { TelaDaCozinha, type PedidoKds } from './tela-da-cozinha';

export const metadata = { title: 'Cozinha (KDS)' };

export default async function PaginaKds() {
  const resposta = await apiServer<PedidoKds[]>('/orders/kds');

  if (resposta.status === 401) redirect('/login');

  if (!resposta.ok || !resposta.data) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Backend indisponível</h1>
          <p className="subtitle">Espere alguns segundos e recarregue a página.</p>
        </div>
      </main>
    );
  }

  return <TelaDaCozinha iniciais={resposta.data} />;
}
