import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  User,
  HelpCircle,
  Power,
  Building2,
  ListChecks,
  CalendarCheck,
  GitBranch,
  MessageSquare,
  TrendingUp,
  FileText,
  Settings,
  Users,
  Tags,
  ChevronDown,
  Bell,
  Search,
  Bot,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from './ui';

interface Item {
  label: string;
  to?: string;
  icon: LucideIcon;
  emBreve?: boolean;
  filhos?: Item[];
}

// Estrutura espelhando o Acessorias (grupo Sistema com submenu).
const MENU: Item[] = [
  {
    label: 'Sistema',
    icon: Settings,
    filhos: [
      { label: 'Usuarios e Permissoes', icon: Users, emBreve: true },
      { label: 'Departamentos e Tags', icon: Tags, to: '/cadastros' },
      { label: 'Configuracoes gerais', icon: Settings, to: '/configuracoes' },
    ],
  },
  { label: 'Obrigacoes', icon: ListChecks, emBreve: true },
  { label: 'Empresas', icon: Building2, to: '/empresas' },
  { label: 'Lista de Entregas', icon: CalendarCheck, emBreve: true },
  { label: 'Gestao de processos', icon: GitBranch, emBreve: true },
  { label: 'Solicitacoes', icon: MessageSquare, emBreve: true },
  { label: 'Robo (e-Robo)', icon: Bot, emBreve: true },
  { label: 'Metodo APLA', icon: TrendingUp, emBreve: true },
  { label: 'Documentos (GED)', icon: FileText, emBreve: true },
  { label: 'Relatorios', icon: FileText, emBreve: true },
];

export default function Layout() {
  const { sessao, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [sistemaAberto, setSistemaAberto] = useState(true);

  async function sair() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-full">
      {/* Sidebar branca */}
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-marca-500 font-bold text-marca-600">
            G
          </span>
          <span className="text-lg font-bold text-slate-700">GestorOA</span>
        </div>

        {/* Botoes de acesso rapido (verde/azul/laranja/vermelho) */}
        <div className="flex gap-2 px-5 pb-3">
          <button className="quickbtn bg-status-ok" title="Inicio" onClick={() => navigate('/')}>
            <Home size={18} />
          </button>
          <button className="quickbtn bg-marca-500" title="Meu perfil" onClick={() => toast('ok', 'Perfil: em breve')}>
            <User size={18} />
          </button>
          <button className="quickbtn bg-status-warn" title="Ajuda" onClick={() => toast('ok', 'Central de ajuda: em breve')}>
            <HelpCircle size={18} />
          </button>
          <button className="quickbtn bg-status-danger" title="Sair" onClick={sair}>
            <Power size={18} />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4 text-sm">
          {MENU.map((item) =>
            item.filhos ? (
              <div key={item.label}>
                <button
                  onClick={() => setSistemaAberto((v) => !v)}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  <item.icon size={18} className="text-marca-500" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={16}
                    className={`transition ${sistemaAberto ? 'rotate-180' : ''}`}
                  />
                </button>
                {sistemaAberto && (
                  <div className="ml-3 border-l border-slate-200 pl-2">
                    {item.filhos.map((f) => (
                      <ItemMenu key={f.label} item={f} toast={toast} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ItemMenu key={item.label} item={item} toast={toast} />
            ),
          )}
        </nav>
      </aside>

      {/* Conteudo */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar azul */}
        <header className="flex items-center gap-4 bg-marca-500 px-6 py-2.5 text-white">
          <div className="relative max-w-md flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-200" />
            <input
              className="w-full rounded-md border-0 bg-marca-400/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-marca-100 outline-none focus:bg-white focus:text-slate-700"
              placeholder="Busca global (em breve)"
              disabled
            />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <button className="relative" title="Notificacoes" onClick={() => toast('ok', 'Notificacoes: em breve')}>
              <Bell size={20} />
            </button>
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{sessao?.usuario.nome}</div>
              <div className="text-xs text-marca-100">{sessao?.escritorio.nome}</div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-100 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ItemMenu({ item, toast }: { item: Item; toast: (t: 'ok' | 'erro', m: string) => void }) {
  if (item.emBreve) {
    return (
      <button
        onClick={() => toast('ok', `${item.label}: em breve`)}
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-slate-400"
        title="Em breve"
      >
        <item.icon size={18} className="text-slate-300" />
        <span className="flex-1 text-left">{item.label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">em breve</span>
      </button>
    );
  }
  return (
    <NavLink
      to={item.to!}
      end={item.to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded px-3 py-2 transition ${
          isActive
            ? 'bg-marca-50 font-medium text-marca-700'
            : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      <item.icon size={18} className="text-marca-500" />
      {item.label}
    </NavLink>
  );
}
