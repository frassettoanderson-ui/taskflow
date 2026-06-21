import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Search, RotateCcw, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner } from '../../components/ui';
import type { Matriz, Departamento } from '../../lib/tipos';

const INP = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-marca-400 focus:ring-1 focus:ring-marca-100';

export default function Matrizes() {
  const { sessao } = useAuth();
  const navigate = useNavigate();
  const podeGerenciar = temPermissao(sessao, 'processos_gerenciar_matrizes');

  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [visao, setVisao] = useState<'principais' | 'todas' | 'inativas' | 'subs'>('principais');
  const [departamentoId, setDepartamentoId] = useState('');

  function carregar() { setLoading(true); api.get<Matriz[]>('/matrizes').then(setMatrizes).finally(() => setLoading(false)); }
  useEffect(carregar, []);
  useEffect(() => { api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined); }, []);

  const nomeDepto = useMemo(() => new Map(departamentos.map((x) => [x.id, x.nome])), [departamentos]);

  const lista = useMemo(() => matrizes.filter((m) => {
    if (nome.trim() && !m.nome.toLowerCase().includes(nome.trim().toLowerCase())) return false;
    if (departamentoId && m.departamentoId !== departamentoId) return false;
    if (visao === 'principais') return m.ativo && !m.soSubmatriz;
    if (visao === 'todas') return true;
    if (visao === 'inativas') return !m.ativo;
    if (visao === 'subs') return m.soSubmatriz;
    return true;
  }), [matrizes, nome, departamentoId, visao]);

  if (loading) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <CheckCircle2 size={16} className="text-slate-400" />
          <span className="font-medium text-slate-700">Gestao de processos</span>
          <span className="text-slate-400">[F10]</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* barra */}
      <div className="rounded border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${INP} w-64 pl-7`} placeholder="Filtrar pelo nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <select className={`${INP} w-48`} value={visao} onChange={(e) => setVisao(e.target.value as never)}>
            <option value="principais">Principais / Ativos</option>
            <option value="todas">Todas</option>
            <option value="inativas">Inativas</option>
            <option value="subs">Somente sub-matrizes</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] font-medium text-marca-600">{lista.length} registros</span>
            <button onClick={() => navigate('/processos')} className="flex items-center gap-2 rounded bg-status-warn px-4 py-1.5 text-[12px] font-medium text-white hover:bg-amber-500"><RotateCcw size={14} /> Voltar</button>
            {podeGerenciar && <button onClick={() => navigate('/processos/matrizes/novo')} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-marca-600"><Plus size={14} /> Nova matriz de processo</button>}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <select className={`${INP} w-72`} value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
            <option value="">Filtrar por departamento</option>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <button className="flex items-center gap-2 rounded bg-status-ok px-5 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-600"><Search size={14} /> Filtrar</button>
        </div>
      </div>

      {/* tabela */}
      <div className="mt-2 overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
              <th className="px-3 py-2">Nome da matriz [Departamento]</th>
              <th className="px-3 py-2 text-center">Passos / Etapas</th>
              <th className="px-3 py-2 text-center">Em andamento</th>
              <th className="px-3 py-2 text-center">So Sub's?</th>
              <th className="px-3 py-2 text-center">Ativo?</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <button onClick={() => navigate(`/processos/matrizes/${m.id}`)} className="text-marca-600 hover:underline">
                    {m.nome}{m.departamentoId && <span className="text-slate-500"> [{nomeDepto.get(m.departamentoId) ?? 'Departamento'}]</span>}
                  </button>
                </td>
                <td className="px-3 py-2 text-center text-slate-600">{m.passos.length}</td>
                <td className="px-3 py-2 text-center text-slate-600">{m.emAndamento ?? 0}</td>
                <td className="px-3 py-2 text-center text-slate-600">{m.soSubmatriz ? 'Sim' : 'Nao'}</td>
                <td className="px-3 py-2 text-center text-slate-600">{m.ativo ? 'Sim' : 'Nao'}</td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={5} className="px-3 py-12 text-center text-slate-400">Nenhuma matriz.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
