import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { MapaDeMesas, type MesaDoMapa, type Chamado, type FilaItem, type Reserva } from './mapa-de-mesas';

export const metadata = { title: 'Salão' };

type Me = { user: { name: string; role: string } };

export default async function PaginaSalao() {
  const [mesas, chamados, fila, reservas, me] = await Promise.all([
    apiServer<MesaDoMapa[]>('/salao/mesas'),
    apiServer<Chamado[]>('/salao/chamados'),
    apiServer<FilaItem[]>('/salao/fila'),
    apiServer<Reserva[]>('/salao/reservas'),
    apiServer<Me>('/auth/me'),
  ]);

  if (mesas.status === 401) redirect('/login');

  if (mesas.status === 403) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Acesso restrito</h1>
          <p className="subtitle">
            Seu perfil não trabalha no salão. Fale com o gerente se precisar deste acesso.
          </p>
        </div>
      </main>
    );
  }

  if (!mesas.ok || !mesas.data) {
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
    <MapaDeMesas
      iniciais={mesas.data}
      chamadosIniciais={chamados.data ?? []}
      filaInicial={fila.data ?? []}
      reservasIniciais={reservas.data ?? []}
      papel={me.data?.user.role ?? 'WAITER'}
    />
  );
}
