import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, FileText, MessageSquare, GitBranch, Info } from 'lucide-react';
import { api } from '../lib/api';

interface Notificacao {
  id: string; tipo: string; titulo: string; mensagem: string; link: string | null; lida: boolean; createdAt: string;
}

const ICONE: Record<string, typeof Bell> = {
  ENTREGA_ATRASADA: AlertTriangle, PRAZO_PROXIMO: Clock, PROTOCOLO_NAO_LIDO: FileText,
  SOLICITACAO: MessageSquare, PROCESSO: GitBranch, SISTEMA: Info,
};
const COR: Record<string, string> = {
  ENTREGA_ATRASADA: 'text-red-500', PRAZO_PROXIMO: 'text-amber-500', PROTOCOLO_NAO_LIDO: 'text-sky-500',
  SOLICITACAO: 'text-marca-500', PROCESSO: 'text-violet-500', SISTEMA: 'text-slate-400',
};

export default function NotificacoesBell() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  function carregarContagem() {
    api.get<{ naoLidas: number }>('/notificacoes/contagem').then((d) => setNaoLidas(d.naoLidas)).catch(() => undefined);
  }
  useEffect(() => {
    carregarContagem();
    const t = setInterval(carregarContagem, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function fora(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  function abrir() {
    const novo = !aberto;
    setAberto(novo);
    if (novo) api.get<{ itens: Notificacao[]; naoLidas: number }>('/notificacoes').then((d) => { setItens(d.itens); setNaoLidas(d.naoLidas); });
  }

  async function clicar(n: Notificacao) {
    if (!n.lida) { await api.post(`/notificacoes/${n.id}/ler`); setNaoLidas((c) => Math.max(0, c - 1)); setItens((l) => l.map((x) => (x.id === n.id ? { ...x, lida: true } : x))); }
    setAberto(false);
    if (n.link) navigate(n.link);
  }

  async function lerTodas() {
    await api.post('/notificacoes/ler-todas');
    setNaoLidas(0);
    setItens((l) => l.map((x) => ({ ...x, lida: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button className="relative" title="Notificacoes" onClick={abrir}>
        <Bell size={20} />
        {naoLidas > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-status-danger px-1 text-[10px] font-bold leading-none text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-md border border-slate-200 bg-white text-slate-700 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold">Notificacoes</span>
            {naoLidas > 0 && <button className="text-xs text-marca-600 hover:underline" onClick={lerTodas}>Marcar todas como lidas</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {itens.length === 0 && <div className="px-3 py-8 text-center text-sm text-slate-400">Nenhuma notificacao.</div>}
            {itens.map((n) => {
              const Icone = ICONE[n.tipo] ?? Info;
              return (
                <button key={n.id} onClick={() => clicar(n)} className={`flex w-full items-start gap-2 border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50 ${n.lida ? '' : 'bg-marca-50/40'}`}>
                  <Icone size={16} className={`mt-0.5 shrink-0 ${COR[n.tipo] ?? 'text-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-medium">{!n.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-marca-500" />}{n.titulo}</div>
                    <div className="truncate text-xs text-slate-500">{n.mensagem}</div>
                    <div className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString('pt-BR')}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <button className="block w-full border-t border-slate-100 py-2 text-center text-xs text-marca-600 hover:bg-slate-50" onClick={() => { setAberto(false); navigate('/notificacoes'); }}>
            Ver todas
          </button>
        </div>
      )}
    </div>
  );
}
