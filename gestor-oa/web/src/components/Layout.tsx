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
  ChevronLeft,
  Search,
  Bot,
  Activity,
  Palette,
  Download,
  Smartphone,
  Star,
  Monitor,
  ClipboardList,
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

// Estrutura espelhando o Acessorias (mesmos nomes/ordem).
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
          { label: 'Baixar agente (instalador)', icon: Download, href: '/gestoroa-agente.exe' },
        ],
      },
      {
        label: 'Aplicativo e Area VIP',
        icon: MessageSquare,
        filhos: [
          { label: 'Area VIP e App', icon: Smartphone, to: '/area-vip/app' },
          { label: 'Comunicados', icon: MessageSquare, to: '/area-vip/comunicados' },
          { label: 'Avaliacao NPS', icon: Star, to: '/area-vip/nps' },
          { label: 'Avaliacao das Solicitacoes', icon: Star, to: '/area-vip/avaliacoes' },
          { label: 'Usuarios do APP', icon: Users, to: '/area-vip/usuarios-app' },
        ],
      },
      { label: 'Dados do meu perfil', icon: User, to: '/perfil' },
      { label: 'Trocar estilo', icon: Palette, tema: true },
      { label: 'Acesso remoto', icon: Monitor, to: '/sistema/acesso-remoto' },
      { label: 'Auditoria', icon: ListChecks, to: '/auditoria' },
      { label: 'Tarefas e Alertas', icon: Activity, to: '/jobs' },
    ],
  },
  { label: 'Obrigacoes', icon: ListChecks, to: '/obrigacoes' },
  { label: 'Empresas', icon: Building2, to: '/empresas' },
  { label: 'Lista de Entregas', icon: CalendarCheck, to: '/entregas' },
  { label: 'Gestao de processos', icon: GitBranch, to: '/processos' },
  { label: 'Solicitacoes', icon: MessageSquare, to: '/solicitacoes-internas' },
  {
    label: 'Metodo APLA',
    icon: TrendingUp,
    filhos: [
      { label: 'Conheca o APLA', icon: TrendingUp, to: '/apla/sobre' },
      { label: 'Dashboard', icon: TrendingUp, to: '/apla' },
      { label: 'Analise produtividade', icon: TrendingUp, to: '/apla/produtividade' },
      { label: 'Analise lucratividade', icon: TrendingUp, to: '/apla/lucratividade' },
    ],
  },
  { label: 'AC Doc`s', icon: FileText, to: '/documentos/armazenamento' },
  {
    label: 'Relatorios',
    icon: ClipboardList,
    filhos: [
      { label: 'Insights com filtros', icon: TrendingUp, to: '/insights' },
      { label: 'Estatisticas semanais', icon: ClipboardList, to: '/relatorios/semanais' },
      { label: 'Estatisticas mensais', icon: ClipboardList, to: '/relatorios/mensais' },
      { label: 'Responsaveis Dptos', icon: Users, to: '/relatorios/responsaveis' },
      { label: 'Exportar e-mails p/ CSV', icon: Download, to: '/relatorios/exportar-emails' },
    ],
  },
];

export default function Layout() {
  const { sessao, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [temaAberto, setTemaAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(() => localStorage.getItem('goa_menu_recolhido') === '1');

  function toggleRecolhido() {
    setRecolhido((v) => { localStorage.setItem('goa_menu_recolhido', v ? '0' : '1'); return !v; });
  }

  async function sair() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-full">
      {/* Sidebar branca (estreita, estilo Acessorias) */}
      <aside className={`flex flex-col border-r border-slate-200 bg-white transition-all ${recolhido ? 'w-16' : 'w-56'}`}>
        {/* Logo */}
        <div className={`flex items-center gap-2 px-4 py-3 ${recolhido ? 'justify-center' : ''}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-marca-500 text-sm font-bold text-marca-600">
            G
          </span>
          {!recolhido && <span className="text-base font-bold text-slate-700">GestorOA</span>}
        </div>

        {/* Botoes de acesso rapido - ocupam toda a largura */}
        {!recolhido && (
          <div className="grid grid-cols-4 gap-1 px-3 pb-2">
            <button className="quickbtn w-full bg-status-ok" title="Inicio" onClick={() => navigate('/')}>
              <Home size={18} />
            </button>
            <button className="quickbtn w-full bg-marca-500" title="Meu perfil" onClick={() => navigate('/perfil')}>
              <User size={18} />
            </button>
            <button className="quickbtn w-full bg-status-warn" title="Ajuda" onClick={() => toast('ok', 'Central de ajuda: em breve')}>
              <HelpCircle size={18} />
            </button>
            <button className="quickbtn w-full bg-status-danger" title="Sair" onClick={sair}>
              <Power size={18} />
            </button>
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 px-1.5 pb-2 text-[13px]">
          <MenuLista itens={MENU} toast={toast} onTema={() => setTemaAberto(true)} recolhido={recolhido} topo />
        </nav>

        {/* Botao redondo para recolher/expandir o menu */}
        <div className="flex justify-center border-t border-slate-100 py-2">
          <button
            onClick={toggleRecolhido}
            title={recolhido ? 'Expandir menu' : 'Recolher menu'}
            className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:bg-slate-50 hover:text-marca-600"
          >
            {recolhido ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
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
// `recolhido` so' afeta o nivel do topo (flyouts sempre expandem com rotulo).
// `topo` aplica as divisorias leves entre os itens principais.
function MenuLista({ itens, toast, onTema, recolhido = false, topo = false }: { itens: Item[]; toast: ToastFn; onTema: () => void; recolhido?: boolean; topo?: boolean }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function abrir(label: string) {
    if (fecharTimer.current) clearTimeout(fecharTimer.current);
    setAberto(label);
  }
  function agendarFechar() {
    if (fecharTimer.current) clearTimeout(fecharTimer.current);
    fecharTimer.current = setTimeout(() => setAberto(null), 350);
  }

  const divisoria = topo ? 'border-b border-slate-100 last:border-0' : '';

  return (
    <div>
      {itens.map((item) => {
        if (item.filhos) {
          return (
            <div
              key={item.label}
              className={`relative ${divisoria}`}
              onMouseEnter={() => abrir(item.label)}
              onMouseLeave={agendarFechar}
            >
              <button
                title={recolhido ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left transition ${recolhido ? 'justify-center' : ''} ${
                  aberto === item.label ? 'bg-marca-50 text-marca-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <item.icon size={17} className={aberto === item.label ? 'text-marca-600' : 'text-slate-400'} />
                {!recolhido && <span className="flex-1">{item.label}</span>}
                {!recolhido && <ChevronRight size={15} className="text-slate-300" />}
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
        return (
          <div key={item.label} className={divisoria}>
            <ItemMenu item={item} toast={toast} onTema={onTema} recolhido={recolhido} />
          </div>
        );
      })}
    </div>
  );
}

function ItemMenu({ item, toast, onTema, recolhido = false }: { item: Item; toast: ToastFn; onTema: () => void; recolhido?: boolean }) {
  const baseCls = `flex w-full items-center gap-3 rounded px-3 py-2 text-left transition ${recolhido ? 'justify-center' : ''}`;

  if (item.tema) {
    return (
      <button onClick={onTema} title={recolhido ? item.label : undefined} className={`${baseCls} text-slate-500 hover:bg-slate-100`}>
        <item.icon size={17} className="text-slate-400" />
        {!recolhido && <span className="flex-1">{item.label}</span>}
      </button>
    );
  }
  if (item.href) {
    return (
      <a href={item.href} download title={recolhido ? item.label : undefined} className={`${baseCls} text-slate-500 hover:bg-slate-100`}>
        <item.icon size={17} className="text-slate-400" />
        {!recolhido && <span className="flex-1">{item.label}</span>}
      </a>
    );
  }
  if (item.emBreve) {
    return (
      <button onClick={() => toast('ok', `${item.label}: em breve`)} title="Em breve" className={`${baseCls} text-slate-400`}>
        <item.icon size={17} className="text-slate-300" />
        {!recolhido && <span className="flex-1">{item.label}</span>}
        {!recolhido && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">em breve</span>}
      </button>
    );
  }
  return (
    <NavLink
      to={item.to!}
      end={item.to === '/'}
      title={recolhido ? item.label : undefined}
      className={({ isActive }) =>
        `${baseCls} border-l-[3px] ${isActive ? 'border-marca-500 bg-marca-50 font-medium text-marca-700' : 'border-transparent text-slate-500 hover:bg-slate-100'}`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon size={17} className={isActive ? 'text-marca-600' : 'text-slate-400'} />
          {!recolhido && <span className="flex-1">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}
