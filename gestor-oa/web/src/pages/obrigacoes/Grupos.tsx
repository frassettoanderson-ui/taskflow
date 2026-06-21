import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Search, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner } from '../../components/ui';

interface GrupoLista { id: string; nome: string; ativo: boolean; obrigacoes: { obrigacaoId: string }[] }

export default function Grupos() {
  const { sessao } = useAuth();
  const navigate = useNavigate();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [grupos, setGrupos] = useState<GrupoLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativos' | 'inativos' | 'todos'>('ativos');

  useEffect(() => { api.get<GrupoLista[]>('/grupos').then(setGrupos).catch(() => setGrupos([])).finally(() => setLoading(false)); }, []);

  if (loading) return <Spinner />;

  const termo = busca.trim().toLowerCase();
  const lista = grupos.filter((g) => {
    const statusOk = status === 'todos' ? true : status === 'ativos' ? g.ativo : !g.ativo;
    return statusOk && (!termo || g.nome.toLowerCase().includes(termo));
  });

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* breadcrumb */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Landmark size={16} className="text-slate-400" />
          <span>Obrigacoes</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-700">Relacao de grupos de obrigacoes</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-400" />
          <input className="w-full rounded border border-marca-300 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-marca-500" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar pelo nome [Enter para filtrar]" />
        </div>
        <select className="rounded border border-slate-300 bg-white px-2 py-2 text-[12px]" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <button className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={16} /> Filtrar</button>
        <div className="flex-1 text-center text-[13px] font-medium text-marca-600">{lista.length} registros</div>
        {podeGerenciar && (
          <button onClick={() => navigate('/obrigacoes/grupos/novo')} className="flex items-center gap-2 rounded bg-marca-500 px-5 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo grupo</button>
        )}
      </div>

      {/* Tabela */}
      <div className="mt-3 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[12px] font-bold text-slate-600">
              <th className="px-4 py-2.5">Grupo de obrigacoes</th>
              <th className="px-4 py-2.5 text-center">Obrigacoes</th>
              <th className="px-4 py-2.5 text-right">Ativo?</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((g) => (
              <tr key={g.id} className="cursor-pointer border-b border-slate-200 odd:bg-white even:bg-fundo hover:bg-caixa" onClick={() => navigate(`/obrigacoes/grupos/${g.id}`)}>
                <td className="px-4 py-2.5"><span className="font-medium text-marca-600">{g.nome}{!g.ativo && <span className="text-slate-400"> [inativo]</span>}</span></td>
                <td className="px-4 py-2.5 text-center text-slate-600">{g.obrigacoes.length}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{g.ativo ? 'Sim' : 'Nao'}</td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-400">Nenhum grupo.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
