import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { AvisoDoPlano } from './aviso-do-plano';
import { PedidosPorTipo } from './pedidos-por-tipo';
import type { PedidoDoPainel, MarcaResumo } from '../pedidos/painel-de-pedidos';

/**
 * A tela inicial do restaurante = os PEDIDOS, separados por tipo.
 *
 * Antes aqui era um painel de atalhos; agora a navegação vive no menu lateral e
 * o centro da tela mostra o que importa no dia a dia: o que está entrando.
 */
export default async function PainelPage() {
  const [me, pedidos, marcas] = await Promise.all([
    apiServer<{ user: unknown }>('/auth/me'),
    apiServer<PedidoDoPainel[]>('/orders?limite=100'),
    apiServer<MarcaResumo[]>('/brands'),
  ]);

  if (me.status === 401) redirect('/login');

  if (!me.ok) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Backend indisponível</h1>
          <p className="subtitle">
            O servidor ainda pode estar subindo. Espere alguns segundos e recarregue a página.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <AvisoDoPlano />
      <PedidosPorTipo iniciais={pedidos.data ?? []} marcas={marcas.data ?? []} />
    </>
  );
}
