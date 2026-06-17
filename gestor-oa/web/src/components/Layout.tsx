import { useRef, useState } from 'react';
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
  ChevronRight,
  Search,
  Bot,
  Activity,
  Palette,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast, Modal } from './ui';
import FAB from './FAB';
import NotificacoesBell from './NotificacoesBell';
import { TEMAS, getTema, setTema, type TemaId } from '../lib/tema';

interface Item {
  label: string;
  to?: string;
  href?: string; // link externo / download (abre fora do router)
  icon: LucideIcon;
  emBreve?: boolean;
  tema?: boolean; // item de acao: abre o seletor "Trocar estilo"
  filhos?: Item[];
}

// Estrutura espelhando o Acessorias (grupo Sistema com submenu lateral/flyout).
const MENU: Item[] = [
  {
    label: 'Sistema',
    icon: Settings,
    filhos: [
      { label: 'Usuarios e Permissoes', icon: Users, to: '/usuarios' },
      { label: 'Departamentos', icon: Tags, to: '/cadastros' },
      { label: 'Configuracoes gerais', icon: Settings, to: '/configuracoes' },
      {
        label: 'e-Continuo',
        icon: Bot,
        filhos: [
          { label: 'Configurar obrigacoes', icon: Settings, to: '/robo/assinaturas' },
          { label: 'Consulta documento', icon: FileText, to: '/robo/revisao' },
          { label: 'Caixa do Robo', icon: Bot, to: '/robo' },
          { label: 'Painel', icon: Activity, to: '/robo/painel' },
          { label: 'Baixar agente (instalador)', icon: Download, href: '/agente-econtinuo.zip' },
        ],
      },
      {
        label: 'Aplicativo e Area VIP',
        icon: MessageSquare,
        filhos: [
          { label: 'Comunicados', icon: MessageSquare, to: '/area-vip/comunicados' },
          { label: 'Solicitacoes (clientes)', icon: MessageSquare, to: '/area-vip/solicitacoes' },
        ],
      },
      { label: 'Dados do meu perfil', icon: User, to: '/perfil' },
      { label: 'Trocar estilo', icon: Palette, tema: true },
      { label: 'Auditoria', icon: ListChecks, to: '/auditoria' },
      { label: 'Tarefas e Alertas', icon: Activity, to: '/jobs' },
    ],
  },
  {
    label: 'Obrigacoes',
    icon: ListChecks,
    filhos: [
      { label: 'Catalogo', icon: ListChecks, to: '/obrigacoes' },
      { label: 'Regimes Tributarios', icon: Settings, to: '/obrigacoes/regimes' },
      { label: 'Grupos', icon: Tags, to: '/obrigacoes/grupos' },
      { label: 'Feriados', icon: CalendarCheck, to: '/obrigacoes/feriados' },
      { label: 'Alocacao em massa', icon: Building2, to: '/obrigacoes/alocacao' },
    ],
  },
  { label: 'Empresas', icon: Building2, to: '/empresas' },
  { label: 'Lista de Entregas', icon: CalendarCheck, to: '/entregas' },
  {
    label: 'Gestao de processos',
    icon: GitBranch,
    filhos: [
      { label: 'Processos', icon: GitBranch, to: '/processos' },
      { label: 'Matrizes', icon: GitBranch, to: '/processos/matrizes' },
    ],
  },
  {
    label: 'Comunicacao',
    icon: MessageSquare,
    filhos: [
      { label: 'Templates de e-mail', icon: MessageSquare, to: '/comunicacao/templates' },
      { label: 'Chatbot', icon: Bot, to: '/comunicacao/chatbot' },
    ],
  },
  { label: 'Solicitacoes internas', icon: MessageSquare, to: '/solicitacoes-internas' },
  { label: 'Insights', icon: TrendingUp, to: '/insights' },
  { label: 'Metodo APLA', icon: TrendingUp, to: '/apla' },
  {
    label: 'Documentos (GED)',
    icon: FileText,
    filhos: [
      { label: 'Armazenamento', icon: FileText, to: '/documentos/armazenamento' },
      { label: 'Protocolos Fisicos', icon: FileText, to: '/documentos/protocolos-fisicos' },
    ],
  },
  { label: 'Relatorios', icon: FileText, emBreve: true },
];

export default function Layout() {
  const { sessao, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [temaAberto, setTemaAberto] = useState(false);

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
          <button className="quickbtn bg-marca-500" title="Meu perfil" onClick={() => navigate('/perfil')}>
            <User size={18} />
          </button>
          <button className="quickbtn bg-status-warn" title="Ajuda" onClick={() => toast('ok', 'Central de ajuda: em breve')}>
            <HelpCircle size={18} />
          </button>
          <button className="quickbtn bg-status-danger" title="Sair" onClick={sair}>
            <Power size={18} />
          </button>
        </div>

        {/* Menu - overflow visivel para os flyouts escaparem da sidebar */}
        <nav className="flex-1 space-y-0.5 px-2 pb-4 text-sm">
          <MenuLista itens={MENU} toast={toast} onTema={() => setTemaAberto(true)} />
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
            <NotificacoesBell />
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

      <FAB />
      {temaAberto && <TrocarEstiloModal onFechar={() => setTemaAberto(false)} />}
    </div>
  );
}

function TrocarEstiloModal({ onFechar }: { onFechar: () => void }) {
  const [sel, setSel] = useState<TemaId>(getTema());
  function escolher(id: TemaId) { setSel(id); setTema(id); }
  return (
    <Modal aberto titulo="Trocar estilo" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Escolha a cor de destaque do sistema. A mudanca e' aplicada na hora.</p>
        <div className="grid grid-cols-2 gap-3">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              onClick={() => escolher(t.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${sel === t.id ? 'border-marca-500 ring-2 ring-marca-200' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: t.cor }} />
              <span className="text-sm font-medium text-slate-700">{t.nome}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end"><button className="btn-primary" onClick={onFechar}>Concluir</button></div>
      </div>
    </Modal>
  );
}

type ToastFn = (t: 'ok' | 'erro', m: string) => void;

// Lista de itens; itens com filhos abrem flyout para a direita.
function MenuLista({ itens, toast, onTema }: { itens: Item[]; toast: ToastFn; onTema: () => void }) {
  const [aberto, setAberto] = useState<string | null>(null);
  // Pequeno atraso para fechar o flyout: da' tempo de mover o mouse do item
  // ate o submenu sem que ele suma no meio do caminho.
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function abrir(label: string) {
    if (fecharTimer.current) clearTimeout(fecharTimer.current);
    setAberto(label);
  }
  function agendarFechar() {
    if (fecharTimer.current) clearTimeout(fecharTimer.current);
    fecharTimer.current = setTimeout(() => setAberto(null), 350);
  }

  return (
    <div className="space-y-0.5">
      {itens.map((item) => {
        if (item.filhos) {
          return (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => abrir(item.label)}
              onMouseLeave={agendarFechar}
            >
              <button
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left transition ${
                  aberto === item.label ? 'bg-marca-50 text-marca-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <item.icon size={18} className="text-marca-500" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight size={16} />
              </button>
              {aberto === item.label && (
                <div
                  className="absolute left-full top-0 z-50 min-w-60 rounded-md border border-slate-200 bg-white p-1 pl-2 shadow-xl"
                  onMouseEnter={() => abrir(item.label)}
                  onMouseLeave={agendarFechar}
                >
                  <MenuLista itens={item.filhos} toast={toast} onTema={onTema} />
                </div>
              )}
            </div>
          );
        }
        return <ItemMenu key={item.label} item={item} toast={toast} onTema={onTema} />;
      })}
    </div>
  );
}

function ItemMenu({ item, toast, onTema }: { item: Item; toast: ToastFn; onTema: () => void }) {
  if (item.tema) {
    return (
      <button
        onClick={onTema}
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-slate-600 hover:bg-slate-100"
      >
        <item.icon size={18} className="text-marca-500" />
        <span className="flex-1">{item.label}</span>
      </button>
    );
  }
  if (item.href) {
    return (
      <a
        href={item.href}
        download
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-slate-600 hover:bg-slate-100"
      >
        <item.icon size={18} className="text-marca-500" />
        <span className="flex-1">{item.label}</span>
      </a>
    );
  }
  if (item.emBreve) {
    return (
      <button
        onClick={() => toast('ok', `${item.label}: em breve`)}
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-slate-400"
        title="Em breve"
      >
        <item.icon size={18} className="text-slate-300" />
        <span className="flex-1">{item.label}</span>
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
          isActive ? 'bg-marca-50 font-medium text-marca-700' : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      <item.icon size={18} className="text-marca-500" />
      {item.label}
    </NavLink>
  );
}
