import { redirect } from 'next/navigation';
import Link from 'next/link';
import { apiServer } from '@/lib/api';
import { LogoutButton } from './logout-button';
import { Marcas } from './marcas';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

/** Id da marca do "restaurante rival" — criado pelo seed só para este teste. */
const ID_MARCA_DE_OUTRA_EMPRESA = 'brd_rival_forno';

const NOME_DO_PAPEL: Record<string, string> = {
  OWNER: 'Dono',
  MANAGER: 'Gerente',
  OPERATOR: 'Operador',
};

type Me = {
  user: { id: string; name: string; email: string; role: string };
  tenant: { id: string; name: string; slug: string } | null;
  brands: Array<{ id: string; name: string; slug: string; primaryColor: string }>;
};

export default async function PainelPage() {
  const me = await apiServer<Me>('/auth/me');

  // Sem crachá válido, volta para o login.
  if (me.status === 401) redirect('/login');

  if (!me.ok || !me.data) {
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

  const { user, tenant } = me.data;

  // ---- Prova viva do isolamento -------------------------------------------
  // Tentamos, logados como você, buscar uma marca que pertence a OUTRA empresa.
  // O esperado é 404: o filtro de tenant faz esse registro simplesmente não
  // existir do seu ponto de vista.
  const tentativa = await apiServer(`/brands/${ID_MARCA_DE_OUTRA_EMPRESA}`);
  const isolamentoOk = tentativa.status === 404;

  // Marcas com a situação de cada canal agora (aberto/fechado/pausado).
  const marcas = await apiServer<MarcaResumo[]>('/brands');

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">Painel</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Olá, {user.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/pedidos">
            <button className="ghost">Pedidos</button>
          </Link>
          <Link href="/kds">
            <button className="ghost">Cozinha (KDS)</button>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="grid">
        <div className="card">
          <div className="stat-label">Empresa (tenant)</div>
          <div className="stat-value">{tenant?.name ?? '—'}</div>
        </div>

        <div className="card">
          <div className="stat-label">Seu perfil</div>
          <div className="stat-value">
            <span className="badge">{NOME_DO_PAPEL[user.role] ?? user.role}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-label">E-mail</div>
          <div className="stat-value" style={{ fontSize: 15 }}>
            {user.email}
          </div>
        </div>
      </section>

      <Marcas iniciais={marcas.data ?? []} />

      <section className={`card proof ${isolamentoOk ? '' : 'fail'}`}>
        <div className="stat-label">Teste de isolamento entre empresas</div>
        {isolamentoOk ? (
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            ✅ <strong>Funcionando.</strong> Pedimos ao backend a marca{' '}
            <code>{ID_MARCA_DE_OUTRA_EMPRESA}</code>, que pertence a outro restaurante, e a
            resposta foi <strong>404 (não encontrada)</strong> — como deve ser. Do seu ponto de
            vista, o dado do vizinho nem existe.
          </p>
        ) : (
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            ❌ <strong>Atenção:</strong> a busca pela marca de outra empresa respondeu{' '}
            <strong>{tentativa.status}</strong> em vez de 404. O isolamento precisa ser revisto.
          </p>
        )}
      </section>

      <p className="hint">
        Esta tela existe só para provar que login, papéis e isolamento por empresa funcionam. As
        funcionalidades começam na Etapa 1 (cardápio → pedido → cozinha → pagamento).
      </p>
    </main>
  );
}
