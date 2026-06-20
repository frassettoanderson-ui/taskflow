import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Lock, Globe, Star } from 'lucide-react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';

interface SolUnif {
  id: string; tipo: 'interna' | 'externa'; titulo: string; status: string; prioridade: string | null;
  empresaNome: string | null; responsavelNome: string | null; departamentoNome: string | null;
  solicitanteNome: string | null; avaliacaoNota: number | null; processoId: string | null; prazo: string | null; createdAt: string;
}

const COR_STATUS: Record<string, string> = {
  ABERTA: '#5b9bd5', EM_ANDAMENTO: '#f0ad4e', AGUARDANDO: '#94a3b8', RESOLVIDA: '#5cb85c', CANCELADA: '#cf3c5d', FINALIZADA: '#5cb85c',
};
const ROTULO: Record<string, string> = {
  ABERTA: 'Aberta', EM_ANDAMENTO: 'Em andamento', AGUARDANDO: 'Aguardando', RESOLVIDA: 'Resolvida', CANCELADA: 'Cancelada', FINALIZADA: 'Finalizada',
};

export default function GestaoSolicitacoes() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<SolUnif[] | null>(null);
  const [tipo, setTipo] = useState('');

  useEffect(() => {
    setItens(null);
    api.get<SolUnif[]>(`/solicitacoes-internas/unificadas${tipo ? `?tipo=${tipo}` : ''}`).then(setItens).catch(() => setItens([]));
  }, [tipo]);

  function abrir(s: SolUnif) {
    navigate(s.tipo === 'interna' ? '/solicitacoes-internas' : '/area-vip/solicitacoes');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800"><Inbox size={22} /> Gestao de Solicitacoes</h1>
          <p className="text-sm text-slate-500">Solicitacoes internas e externas (clientes) em uma unica tela. O cadeado indica o tipo.</p>
        </div>
        <div className="flex gap-1 rounded border border-slate-200 bg-white p-1 text-sm">
          {[{ v: '', l: 'Todas' }, { v: 'interna', l: 'Internas' }, { v: 'externa', l: 'Externas' }].map((o) => (
            <button key={o.v} onClick={() => setTipo(o.v)} className={`rounded px-3 py-1 ${tipo === o.v ? 'bg-marca-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{o.l}</button>
          ))}
        </div>
      </div>

      {!itens ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Titulo</th><th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Responsavel</th><th className="px-3 py-2">Departamento</th><th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Avaliacao</th><th className="px-3 py-2">Aberta em</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((s) => (
                <tr key={`${s.tipo}-${s.id}`} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => abrir(s)}>
                  <td className="px-3 py-2">
                    {s.tipo === 'interna'
                      ? <span title="Interna" className="inline-flex items-center gap-1 text-slate-500"><Lock size={14} /> Interna</span>
                      : <span title="Externa (cliente)" className="inline-flex items-center gap-1 text-marca-600"><Globe size={14} /> Externa</span>}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-700">{s.titulo}{s.processoId && <span className="ml-1 text-xs text-marca-500">· com processo</span>}</td>
                  <td className="px-3 py-2 text-slate-500">{s.empresaNome ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{s.responsavelNome ?? (s.tipo === 'externa' ? s.solicitanteNome : '—')}</td>
                  <td className="px-3 py-2 text-slate-500">{s.departamentoNome ?? '—'}</td>
                  <td className="px-3 py-2"><span className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ background: COR_STATUS[s.status] ?? '#94a3b8' }}>{ROTULO[s.status] ?? s.status}</span></td>
                  <td className="px-3 py-2 text-amber-500">{s.avaliacaoNota ? <span className="inline-flex items-center gap-0.5">{s.avaliacaoNota} <Star size={12} /></span> : '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
              {itens.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">Nenhuma solicitacao.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">Clique numa linha para abrir a tela completa do tipo correspondente.</p>
    </div>
  );
}
