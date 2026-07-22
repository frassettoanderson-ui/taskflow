import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import {
  TelaDeEntregas,
  type Entregador,
  type Corrida,
  type PedidoSemEntregador,
} from './tela-de-entregas';

export const metadata = { title: 'Entregas' };

export default async function PaginaEntregadores() {
  const [entregadores, corridas, semEntregador] = await Promise.all([
    apiServer<Entregador[]>('/gestao/entregadores'),
    apiServer<Corrida[]>('/gestao/entregas'),
    apiServer<PedidoSemEntregador[]>('/gestao/entregas/sem-entregador'),
  ]);

  if (entregadores.status === 401) redirect('/login');

  if (entregadores.status === 403) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Acesso restrito</h1>
          <p className="subtitle">As entregas são para dono, gerente e caixa.</p>
        </div>
      </main>
    );
  }

  if (!entregadores.ok || !entregadores.data) {
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
    <TelaDeEntregas
      entregadoresIniciais={entregadores.data}
      corridasIniciais={corridas.data ?? []}
      semEntregadorIniciais={semEntregador.data ?? []}
    />
  );
}
