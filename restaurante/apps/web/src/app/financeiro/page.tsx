import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { TelaFinanceira, type Dre, type Lancamento, type Resumo, type Acerto } from './tela-financeira';

export const metadata = { title: 'Financeiro' };

export default async function PaginaFinanceiro() {
  const [dre, lancamentos, resumo, acertos] = await Promise.all([
    apiServer<Dre>('/gestao/financeiro/dre'),
    apiServer<Lancamento[]>('/gestao/financeiro/lancamentos'),
    apiServer<Resumo>('/gestao/financeiro/resumo'),
    apiServer<Acerto[]>('/gestao/acertos'),
  ]);

  if (dre.status === 401) redirect('/login');

  if (dre.status === 403) {
    return (
      <main className="center-screen">
        <div className="card card--login">
          <h1 className="title">Acesso restrito</h1>
          <p className="subtitle">O financeiro é para dono e gerente.</p>
        </div>
      </main>
    );
  }

  if (!dre.ok || !dre.data) {
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
    <TelaFinanceira
      dreInicial={dre.data}
      lancamentosIniciais={lancamentos.data ?? []}
      resumoInicial={resumo.data ?? null}
      acertosIniciais={acertos.data ?? []}
    />
  );
}
