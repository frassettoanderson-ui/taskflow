import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, FileText, MessageSquare, GitBranch, Info, Trash2, Check } from 'lucide-react';
import { api } from '../lib/api';
import { Spinner, useToast } from '../components/ui';

interface Notificacao { id: string; tipo: string; titulo: string; mensagem: string; link: string | null; lida: boolean; createdAt: string }

const ICONE: Record<string, typeof Info> = {
  ENTREGA_ATRASADA: AlertTriangle, PRAZO_PROXIMO: Clock, PROTOCOLO_NAO_LIDO: FileText,
  SOLICITACAO: MessageSquare, PROCESSO: GitBranch, SISTEMA: Info,
};
const COR: Record<string, string> = {
  ENTREGA_ATRASADA: 'text-red-500', PRAZO_PROXIMO: 'text-amber-500', PROTOCOLO_NAO_LIDO: 'text-sky-500',
  SOLICITACAO: 'text-marca-500', PROCESSO: 'text-violet-500', SISTEMA: 'text-slate-400',
};

export default function Notificacoes() {
  const toast = useToast();
  const navigate = useNavigate();
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<{ itens: Notificacao[] }>(`/notificacoes${apenasNaoLidas ? '?naoLidas=true' : ''}`).then((d) => setItens(d.itens)).finally(() => setLoading(false));
  }
  useEffect(carregar, [apenasNaoLidas]);

  async function ler(id: string) { await api.post(`/notificacoes/${id}/ler`); carregar(); }
  async function lerTodas() { await api.post('/notificacoes/ler-todas'); toast('ok', 'Todas marcadas como lidas.'); carregar(); }
  async function remover(id: string) { await api.del(`/notificacoes/${id}`); carregar(); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-800">Notificacoes</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={apenasNaoLidas} onChange={(e) => setApenasNaoLidas(e.target.checked)} /> So nao lidas
          </label>
          <button className="btn-ghost border border-slate-300" onClick={lerTodas}><Check size={16} /> Marcar todas</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="card divide-y divide-slate-100">
          {itens.length === 0 && <div className="px-4 py-12 text-center text-slate-400">Nenhuma notificacao.</div>}
          {itens.map((n) => {
            const Icone = ICONE[n.tipo] ?? Info;
            return (
              <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.lida ? '' : 'bg-marca-50/40'}`}>
                <Icone size={18} className={`mt-0.5 shrink-0 ${COR[n.tipo] ?? 'text-slate-400'}`} />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { if (!n.lida) ler(n.id); if (n.link) navigate(n.link); }}>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">{!n.lida && <span className="h-1.5 w-1.5 rounded-full bg-marca-500" />}{n.titulo}</div>
                  <div className="text-sm text-slate-500">{n.mensagem}</div>
                  <div className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('pt-BR')}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!n.lida && <button title="Marcar como lida" className="text-slate-400 hover:text-marca-600" onClick={() => ler(n.id)}><Check size={16} /></button>}
                  <button title="Remover" className="text-slate-400 hover:text-red-600" onClick={() => remover(n.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
