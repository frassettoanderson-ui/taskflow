import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plus, Trash2, Pencil, Play } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Modal, Spinner, useToast } from '../../components/ui';
import type { PainelDef, Indicador } from '../../lib/tipos';

export default function Paineis() {
  const toast = useToast();
  const navigate = useNavigate();
  const [lista, setLista] = useState<PainelDef[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editar, setEditar] = useState<PainelDef | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<PainelDef[]>('/dashboard/paineis').then(setLista).finally(() => setLoading(false));
  }
  useEffect(() => {
    carregar();
    api.get<Indicador[]>('/dashboard/indicadores').then(setIndicadores).catch(() => undefined);
  }, []);

  async function remover(p: PainelDef) {
    if (!confirm(`Excluir o painel "${p.nome}"?`)) return;
    try { await api.del(`/dashboard/paineis/${p.id}`); toast('ok', 'Painel excluido.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800"><LayoutDashboard size={22} /> Cadastro de Paineis</h1>
          <p className="text-sm text-slate-500">Agrupe indicadores em paineis para exibir no carrossel. <Link to="/dashboard/indicadores" className="text-marca-600 hover:underline">Gerenciar indicadores</Link></p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setNovo(true)}><Plus size={16} /> Novo painel</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((p) => (
          <div key={p.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between">
              <h2 className="font-semibold text-marca-700">{p.nome}</h2>
              <div className="flex gap-1">
                <button title="Exibir" className="text-slate-400 hover:text-emerald-600" onClick={() => navigate(`/dashboard?painel=${p.id}`)}><Play size={16} /></button>
                <button title="Editar" className="text-slate-400 hover:text-marca-600" onClick={() => setEditar(p)}><Pencil size={16} /></button>
                <button title="Excluir" className="text-slate-400 hover:text-red-500" onClick={() => remover(p)}><Trash2 size={16} /></button>
              </div>
            </div>
            <p className="text-xs text-slate-500">{p.indicadores.length} indicador(es) - troca a cada {p.transicaoSeg}s - {p.ativo ? 'ativo' : 'inativo'}</p>
            <div className="flex flex-wrap gap-1">
              {p.indicadores.map((pi) => <span key={pi.indicadorId} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{pi.indicador.nome}</span>)}
            </div>
          </div>
        ))}
        {lista.length === 0 && <p className="col-span-full py-10 text-center text-slate-400">Nenhum painel cadastrado.</p>}
      </div>

      {(novo || editar) && (
        <PainelForm inicial={editar} indicadores={indicadores} onFechar={() => { setNovo(false); setEditar(null); }} onFeito={() => { setNovo(false); setEditar(null); carregar(); }} />
      )}
    </div>
  );
}

function PainelForm({ inicial, indicadores, onFechar, onFeito }: {
  inicial: PainelDef | null; indicadores: Indicador[]; onFechar: () => void; onFeito: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [transicaoSeg, setTransicaoSeg] = useState(inicial?.transicaoSeg ?? 60);
  const [visibilidade, setVisibilidade] = useState<'todos' | 'somente_meu'>(inicial?.visibilidade ?? 'todos');
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [sel, setSel] = useState<string[]>(inicial?.indicadores.map((i) => i.indicadorId) ?? []);
  const [salvando, setSalvando] = useState(false);

  function toggle(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function salvar() {
    if (!nome.trim()) return toast('erro', 'Informe o nome.');
    if (sel.length === 0) return toast('erro', 'Selecione ao menos um indicador.');
    setSalvando(true);
    const payload = { nome, transicaoSeg, visibilidade, ativo, indicadorIds: sel };
    try {
      if (inicial) await api.put(`/dashboard/paineis/${inicial.id}`, payload);
      else await api.post('/dashboard/paineis', payload);
      toast('ok', 'Painel salvo.'); onFeito();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={inicial ? 'Editar painel' : 'Novo painel'} onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Nome do painel</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Visao geral" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Transicao (segundos)</label>
            <select className="input" value={transicaoSeg} onChange={(e) => setTransicaoSeg(Number(e.target.value))}>
              {[30, 60, 90, 120].map((s) => <option key={s} value={s}>{s}s</option>)}
            </select>
          </div>
          <div>
            <label className="label">Visibilidade</label>
            <select className="input" value={visibilidade} onChange={(e) => setVisibilidade(e.target.value as never)}>
              <option value="todos">Todos os usuarios</option>
              <option value="somente_meu">Somente eu</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Indicadores ({sel.length} selecionado(s))</label>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
            {indicadores.length === 0 && <p className="text-sm text-slate-400">Nenhum indicador. Crie indicadores primeiro.</p>}
            {indicadores.map((i) => (
              <label key={i.id} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={sel.includes(i.id)} onChange={() => toggle(i.id)} />
                {i.nome} <span className="text-xs text-slate-400">({i.tipo})</span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Painel ativo
        </label>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}
