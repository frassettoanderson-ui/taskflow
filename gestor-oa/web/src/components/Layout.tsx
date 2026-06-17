import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface ItemMenu {
  label: string;
  to?: string;
  emBreve?: boolean;
}

// Estrutura completa de modulos do produto. Itens sem rota ainda
// (emBreve) ficam visiveis mas desabilitados ate' serem implementados.
const MENU: ItemMenu[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Empresas', emBreve: true },
  { label: 'Obrigacoes', emBreve: true },
  { label: 'Lista de Entregas', emBreve: true },
  { label: 'Processos', emBreve: true },
  { label: 'Documentos (GED)', emBreve: true },
  { label: 'Comunicacao', emBreve: true },
  { label: 'Robo', emBreve: true },
  { label: 'Solicitacoes', emBreve: true },
  { label: 'Insights', emBreve: true },
  { label: 'Lucratividade', emBreve: true },
  { label: 'Usuarios', emBreve: true },
  { label: 'Configuracoes', to: '/configuracoes' },
];

export default function Layout() {
  const { sessao, logout } = useAuth();
  const navigate = useNavigate();

  async function sair() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-full">
      {/* Sidebar fixa */}
      <aside className="flex w-60 flex-col bg-petroleo-800 text-petroleo-50">
        <div className="flex items-center gap-2 px-5 py-4 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded bg-petroleo-600 text-white">
            G
          </span>
          GestorOA
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2 text-sm">
          {MENU.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `block rounded px-3 py-2 transition ${
                    isActive
                      ? 'bg-petroleo-600 text-white'
                      : 'text-petroleo-100 hover:bg-petroleo-700'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.label}
                className="flex items-center justify-between rounded px-3 py-2 text-petroleo-300/70"
                title="Em breve"
              >
                {item.label}
                <span className="rounded bg-petroleo-700 px-1.5 py-0.5 text-[10px]">
                  em breve
                </span>
              </span>
            ),
          )}
        </nav>
      </aside>

      {/* Conteudo */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <input
            className="input max-w-md"
            placeholder="Busca global (em breve)"
            disabled
          />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <div className="font-medium text-slate-700">
                {sessao?.usuario.nome}
              </div>
              <div className="text-xs text-slate-400">
                {sessao?.escritorio.nome}
              </div>
            </div>
            <button onClick={sair} className="btn-ghost">
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
