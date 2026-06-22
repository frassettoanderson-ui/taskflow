import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  User,
  HelpCircle,
  Power,
  Globe,
  List,
  Heart,
  CheckCircle,
  Folder,
  MessageSquare,
  TrendingUp,
  FileText,
  Settings,
  Users,
  Tags,
  ChevronRight,
  ChevronLeft,
  Bot,
  Activity,
  Palette,
  Download,
  Smartphone,
  Star,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from './ui';
import FAB from './FAB';
import NotificacoesBell from './NotificacoesBell';
import { ciclarMenuEstilo } from '../lib/menuEstilo';

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
    icon: Globe,
    filhos: [
      { label: 'Usuarios e Permissoes', icon: Users, to: '/usuarios' },
      { label: 'Departamentos', icon: Tags, to: '/cadastros' },
      { label: 'Configuracoes gerais', icon: Settings, to: '/configuracoes' },
      {
        label: 'e-Continuo',
        icon: Bot,
        filhos: [
          { label: 'Configurar obrigacoes', icon: Settings, to: '/robo/assinaturas' },
          { label: 'Consulta documento', icon: FileText, to: '/robo/consulta' },
          { label: 'Caixa do Robo', icon: Bot, to: '/robo' },
          { label: 'Painel', icon: Activity, to: '/robo/painel' },
          { label: 'Instalador Windows 10', icon: Download, href: '/gestoroa-agente.exe' },
          { label: 'Instalador Windows 8', icon: Download, href: '/gestoroa-agente.exe' },
          { label: 'Instalador Windows 7', icon: Download, href: '/gestoroa-agente.exe' },
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
    ],
  },
  { label: 'Obrigacoes', icon: List, to: '/obrigacoes' },
  { label: 'Empresas', icon: Heart, to: '/empresas' },
  { label: 'Lista de Entregas', icon: CheckCircle, to: '/entregas' },
  { label: 'Documentos (GED)', icon: FileText, to: '/documentos/armazenamento' },
  {
    label: 'Relatorios',
    icon: Folder,
    filhos: [
      { label: 'Insights com filtros', icon: TrendingUp, to: '/insights' },
      { label: 'Indicadores (Dashboard)', icon: TrendingUp, to: '/dashboard/indicadores' },
      { label: 'Paineis (Dashboard)', icon: TrendingUp, to: '/dashboard/paineis' },
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
  const location = useLocation();
  const [recolhido, setRecolhido] = useState(() => localStorage.getItem('goa_menu_recolhido') === '1');

  function toggleRecolhido() {
    setRecolhido((v) => { localStorage.setItem('goa_menu_recolhido', v ? '0' : '1'); return !v; });
  }

  async function sair() {
    await logout();
    navigate('/login');
  }

  // Atalhos de teclado globais (estilo Acessorias)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return; // nao interferir em campos
      let destino: string | null = null;
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === 'F1') destino = '/configuracoes';
        else if (e.key === 'F2') destino = '/entregas';
        else if (e.key === 'F3') destino = '/empresas';
        else if (e.key === 'F6') destino = '/obrigacoes';
      } else if (e.ctrlKey && !e.altKey && (e.key === 'u' || e.key === 'U')) destino = '/usuarios';
      else if (e.ctrlKey && !e.altKey && (e.key === 'k' || e.key === 'K')) destino = '/robo/consulta';
      else if (e.altKey && !e.ctrlKey && (e.key === 'c' || e.key === 'C')) destino = '/area-vip/comunicados';
      if (destino) { e.preventDefault(); navigate(destino); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="flex h-full">
      {/* Sidebar branca (estreita, estilo Acessorias) */}
      <aside className={`flex flex-col border-r-2 border-marca-500 bg-[var(--m-sbg)] transition-all ${recolhido ? 'w-16' : 'w-56'}`}>
        {/* Logo */}
        <div className={`flex items-center gap-2 px-4 py-3 ${recolhido ? 'justify-center' : ''}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-marca-500 text-sm font-bold text-marca-600">
            G
          </span>
          {!recolhido && <span className="text-base font-bold text-[color:var(--m-title)]">GestorOA</span>}
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
        <nav className="flex-1 px-1.5 pb-2 text-[12.5px]">
          <MenuLista itens={MENU} toast={toast} onTema={() => { const e = ciclarMenuEstilo(); toast('ok', `Estilo do menu: ${e}`); }} recolhido={recolhido} topo />
        </nav>

        {/* Botao redondo para recolher/expandir o menu */}
        <div className="flex justify-center border-t border-[color:var(--m-bd)] py-2">
          <button
            onClick={toggleRecolhido}
            title={recolhido ? 'Expandir menu' : 'Recolher menu'}
            className="grid h-7 w-7 place-items-center rounded-full border border-[color:var(--m-bd)] bg-[var(--m-bg)] text-[color:var(--m-ic)] shadow-sm hover:bg-[var(--m-hv)] hover:text-[color:var(--m-afg)]"
          >
            {recolhido ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Conteudo */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar azul */}
        <header className="flex items-center gap-4 bg-marca-500 px-6 py-2.5 text-white">
          <div className="ml-auto flex items-center gap-4">
            <NotificacoesBell />
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{sessao?.usuario.nome}</div>
              <div className="text-xs text-marca-100">{sessao?.escritorio.nome}</div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-fundo p-6">
          {/* key na rota: re-dispara a animacao de surgimento a cada troca de tela */}
          <div key={location.pathname} className="page-anim h-full">
            <Outlet />
          </div>
        </main>
      </div>

      <FAB />
    </div>
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

  const divisoria = topo ? 'border-b border-[color:var(--m-bd)] last:border-0' : '';

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
                className={`flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition ${recolhido ? 'justify-center' : ''} ${
                  aberto === item.label ? 'bg-[var(--m-abg)] text-[color:var(--m-afg)]' : 'text-[color:var(--m-fg)] hover:bg-[var(--m-hv)]'
                }`}
              >
                <item.icon size={15} className={aberto === item.label ? 'text-[color:var(--m-afg)]' : 'text-[color:var(--m-ic)]'} />
                {!recolhido && <span className="flex-1">{item.label}</span>}
                {!recolhido && <ChevronRight size={15} className="text-[color:var(--m-ic)]" />}
              </button>
              {aberto === item.label && (
                <div
                  className="absolute left-full top-0 z-50 min-w-60 rounded-md border border-[color:var(--m-bd)] bg-[var(--m-bg)] p-1 pl-2 shadow-xl"
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
  const baseCls = `flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition ${recolhido ? 'justify-center' : ''}`;

  if (item.tema) {
    return (
      <button onClick={onTema} title={recolhido ? item.label : undefined} className={`${baseCls} text-[color:var(--m-fg)] hover:bg-[var(--m-hv)]`}>
        <item.icon size={15} className="text-[color:var(--m-ic)]" />
        {!recolhido && <span className="flex-1">{item.label}</span>}
      </button>
    );
  }
  if (item.href) {
    return (
      <a href={item.href} download title={recolhido ? item.label : undefined} className={`${baseCls} text-[color:var(--m-fg)] hover:bg-[var(--m-hv)]`}>
        <item.icon size={15} className="text-[color:var(--m-ic)]" />
        {!recolhido && <span className="flex-1">{item.label}</span>}
      </a>
    );
  }
  if (item.emBreve) {
    return (
      <button onClick={() => toast('ok', `${item.label}: em breve`)} title="Em breve" className={`${baseCls} text-[color:var(--m-ic)]`}>
        <item.icon size={15} className="text-[color:var(--m-ic)]" />
        {!recolhido && <span className="flex-1">{item.label}</span>}
        {!recolhido && <span className="rounded bg-[var(--m-hv)] px-1.5 py-0.5 text-[10px] text-[color:var(--m-ic)]">em breve</span>}
      </button>
    );
  }
  return (
    <NavLink
      to={item.to!}
      end={item.to === '/'}
      title={recolhido ? item.label : undefined}
      className={({ isActive }) =>
        `${baseCls} border-l-[3px] ${isActive ? 'border-[color:var(--m-acc)] bg-[var(--m-abg)] font-medium text-[color:var(--m-afg)]' : 'border-transparent text-[color:var(--m-fg)] hover:bg-[var(--m-hv)]'}`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon size={15} className={isActive ? 'text-[color:var(--m-afg)]' : 'text-[color:var(--m-ic)]'} />
          {!recolhido && <span className="flex-1">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}
