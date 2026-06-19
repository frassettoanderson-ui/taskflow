import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Search, Printer, Plus } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Modal, Spinner, useToast } from '../../components/ui';
import { SeletorObrigacoes } from './SeletorObrigacoes';
import type { Regime, Obrigacao } from '../../lib/tipos';

function relUrl(tipo: 'obrigacoes' | 'empresas', r?: Regime) {
  const qs = new URLSearchParams({ tipo });
  if (r) { qs.set('regimeId', r.id); qs.set('regimeNome', r.nome); }
  return `/obrigacoes/regimes/relatorio?${qs}`;
}

export default function Regimes() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [imprimirAberto, setImprimirAberto] = useState(false);
  const imprimirRef = useRef<HTMLDivElement>(null);
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Regime | null>(null);
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativos' | 'inativos' | 'todos'>('ativos');

  function carregar() {
    setLoading(true);
    api.get<Regime[]>('/regimes').then(setRegimes).finally(() => setLoading(false));
  }
  useEffect(() => {
    carregar();
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
  }, []);
  useEffect(() => {
    function fora(e: MouseEvent) { if (imprimirRef.current && !imprimirRef.current.contains(e.target as Node)) setImprimirAberto(false); }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  async function excluir(r: Regime) {
    if (!confirm(`Excluir o regime "${r.nome}"?`)) return;
    try { await api.del(`/regimes/${r.id}`); toast('ok', 'Regime excluido.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;

  const lista = regimes.filter((r) => {
    const statusOk = status === 'todos' ? true : status === 'ativos' ? r.ativo : !r.ativo;
    const buscaOk = !busca.trim() || r.nome.toLowerCase().includes(busca.trim().toLowerCase());
    return statusOk && buscaOk;
  });

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
      {/* Cabecalho */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Landmark size={16} className="text-slate-400" />
          <span>Obrigacoes</span><span className="text-slate-300">›</span>
          <span className="text-slate-700">Relacao de regimes tributarios</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
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
        <button onClick={carregar} className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={16} /> Filtrar</button>
        <div className="flex-1 text-center text-[13px] font-medium text-marca-600">{lista.length} registros</div>
        <div className="relative" ref={imprimirRef}>
          <button title="Imprimir" onClick={() => setImprimirAberto((v) => !v)} className="text-marca-600 hover:text-marca-800"><Printer size={18} /></button>
          {imprimirAberto && (
            <div className="absolute right-0 top-8 z-50 flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
              <button onClick={() => navigate(relUrl('empresas'))} className="flex items-center gap-2 whitespace-nowrap rounded bg-purple-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-600"><Printer size={13} /> Empresas por regime</button>
              <button onClick={() => navigate(relUrl('obrigacoes'))} className="flex items-center gap-2 whitespace-nowrap rounded bg-amber-400 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"><Printer size={13} /> Obrigacoes por regime</button>
            </div>
          )}
        </div>
        {podeGerenciar && (
          <button onClick={() => setNovo(true)} className="flex items-center gap-2 rounded bg-marca-500 px-5 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo regime</button>
        )}
      </div>

      {/* Tabela */}
      <div className="mt-3 overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
              <th className="px-4 py-2.5">Regime tributario</th>
              <th className="px-4 py-2.5">Obrigacoes</th>
              <th className="px-4 py-2.5">Empresas</th>
              <th className="px-4 py-2.5 text-right">Ativo?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <button onClick={() => podeGerenciar ? setEditando(r) : undefined} className="text-marca-600 hover:underline">{r.nome}{!r.ativo && <span className="text-slate-400"> [inativo]</span>}</button>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-slate-600">{r.obrigacoes.length}
                    <button title="Relacao de obrigacoes desse regime" onClick={() => navigate(relUrl('obrigacoes', r))} className="text-marca-400 hover:text-marca-600"><Printer size={14} /></button>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-slate-600">{r._count?.empresas ?? 0}
                    <button title="Relacao de empresas desse regime" onClick={() => navigate(relUrl('empresas', r))} className="text-marca-400 hover:text-marca-600"><Printer size={14} /></button>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-slate-600">{r.ativo ? 'Sim' : 'Nao'}</td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Nenhum regime.</td></tr>}
          </tbody>
        </table>
      </div>

      {(novo || editando) && (
        <RegimeModal
          regime={editando}
          obrigacoes={obrigacoes}
          onFechar={() => { setNovo(false); setEditando(null); }}
          onSalvo={() => { setNovo(false); setEditando(null); carregar(); }}
          onExcluir={editando && podeGerenciar ? () => { const r = editando; setEditando(null); excluir(r); } : undefined}
        />
      )}
    </div>
  );
}

function RegimeModal({
  regime, obrigacoes, onFechar, onSalvo, onExcluir,
}: { regime: Regime | null; obrigacoes: Obrigacao[]; onFechar: () => void; onSalvo: () => void; onExcluir?: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(regime?.nome ?? '');
  const [sel, setSel] = useState<Set<string>>(new Set(regime?.obrigacoes.map((o) => o.obrigacaoId) ?? []));
  const [salvando, setSalvando] = useState(false);

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const payload = { nome, obrigacoes: [...sel].map((obrigacaoId) => ({ obrigacaoId })) };
      if (regime) await api.put(`/regimes/${regime.id}`, payload);
      else await api.post('/regimes', payload);
      toast('ok', 'Regime salvo.');
      onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={regime ? 'Editar regime' : 'Novo regime'} onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="label">Nome *</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="label">Obrigacoes do regime ({sel.size})</label>
          <SeletorObrigacoes obrigacoes={obrigacoes} selecionados={sel} onToggle={toggle} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>{onExcluir && <button className="text-sm text-red-500 hover:underline" onClick={onExcluir}>Excluir regime</button>}</div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
            <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
