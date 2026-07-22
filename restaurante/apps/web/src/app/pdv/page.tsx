import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { Caixa } from './caixa';

export const metadata = { title: 'PDV — Balcão' };

type Me = { user: { id: string; name: string; role: string } };

/** Quem pode operar o caixa. Garçom fica de fora: ele não mexe em dinheiro. */
const PODE = ['OWNER', 'MANAGER', 'CASHIER'];

export default async function PaginaPdv() {
  const me = await apiServer<Me>('/auth/me');
  if (me.status === 401 || !me.data) redirect('/login');

  if (!PODE.includes(me.data.user.role)) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Sem acesso ao caixa</h1>
          <p className="subtitle">
            O PDV é do dono, do gerente e do caixa. Seu perfil é{' '}
            <strong>{me.data.user.role}</strong>.
          </p>
        </div>
      </main>
    );
  }

  return <Caixa operador={me.data.user.name} />;
}
