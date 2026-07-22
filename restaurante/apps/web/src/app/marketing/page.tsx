import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { TelaDeMarketing, type Cupom, type Campanha, type Nps, type Mensagem, type Carrinho } from './tela-de-marketing';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

export const metadata = { title: 'Marketing' };

export default async function PaginaMarketing() {
  const [cupons, campanhas, nps, mensagens, carrinhos, marcas] = await Promise.all([
    apiServer<Cupom[]>('/marketing/cupons'),
    apiServer<Campanha[]>('/marketing/campanhas'),
    apiServer<Nps>('/marketing/nps'),
    apiServer<Mensagem[]>('/marketing/mensagens?limite=50'),
    apiServer<Carrinho[]>('/marketing/carrinhos'),
    apiServer<MarcaResumo[]>('/brands'),
  ]);

  if (cupons.status === 401) redirect('/login');

  if (cupons.status === 403) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Acesso restrito</h1>
          <p className="subtitle">Marketing é acessível para dono e gerente.</p>
        </div>
      </main>
    );
  }

  if (!cupons.ok) {
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
    <TelaDeMarketing
      cuponsIniciais={cupons.data ?? []}
      campanhasIniciais={campanhas.data ?? []}
      npsInicial={nps.data ?? null}
      mensagensIniciais={mensagens.data ?? []}
      carrinhosIniciais={carrinhos.data ?? []}
      marcas={marcas.data ?? []}
    />
  );
}
