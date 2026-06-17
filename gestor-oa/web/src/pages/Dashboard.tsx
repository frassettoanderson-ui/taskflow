import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { sessao } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">
          Ola, {sessao?.usuario.nome?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500">
          Bem-vindo ao GestorOA. Os modulos operacionais serao habilitados nas
          proximas fases.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { titulo: 'Empresas', valor: '—', nota: 'Modulo 1' },
          { titulo: 'Entregas no mes', valor: '—', nota: 'Modulo 3' },
          { titulo: 'Pendentes', valor: '—', nota: 'Modulo 3' },
          { titulo: 'Processos', valor: '—', nota: 'Modulo 6' },
        ].map((c) => (
          <div key={c.titulo} className="card p-5">
            <div className="text-sm text-slate-500">{c.titulo}</div>
            <div className="mt-1 text-3xl font-bold text-slate-800">
              {c.valor}
            </div>
            <div className="mt-1 text-xs text-slate-400">{c.nota}</div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-700">Fase atual</h2>
        <p className="mt-2 text-sm text-slate-500">
          <strong>Modulo 0 — Fundacao, Auth e Tenant</strong> concluido:
          cadastro de escritorio, login com horarios, recuperacao de senha,
          multi-tenant, RBAC granular, auditoria e configuracoes do escritorio.
        </p>
      </div>
    </div>
  );
}
