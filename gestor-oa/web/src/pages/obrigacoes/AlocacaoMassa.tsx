import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../components/ui';
import type { Obrigacao, Grupo, EmpresaLista, Tag } from '../../lib/tipos';

interface Pagina { items: EmpresaLista[]; total: number; totalPages: number; page: number }

export default function AlocacaoMassa() {
  const toast = useToast();
  const [modo, setModo] = useState<'obrigacao' | 'grupo'>('obrigacao');
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [obrigacaoId, setObrigacaoId] = useState('');
  const [grupoId, setGrupoId] = useState('');

  const [empresas, setEmpresas] = useState<EmpresaLista[]>([]);
  const [filtroTag, setFiltroTag] = useState('');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
    api.get<Grupo[]>('/grupos').then(setGrupos).catch(() => undefined);
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ limit: '100', status: 'ativos' });
      if (busca.trim()) qs.set('busca', busca.trim());
      if (filtroTag) qs.set('tagId', filtroTag);
      api.get<Pagina>(`/empresas?${qs}`).then((p) => setEmpresas(p.items)).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [busca, filtroTag]);

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selecionarTodos() {
    setSel((s) => {
      const todos = empresas.every((e) => s.has(e.id));
      const n = new Set(s);
      empresas.forEach((e) => (todos ? n.delete(e.id) : n.add(e.id)));
      return n;
    });
  }

  async function aplicar() {
    if (sel.size === 0) return toast('erro', 'Selecione empresas.');
    if (modo === 'obrigacao' && !obrigacaoId) return toast('erro', 'Selecione a obrigacao.');
    if (modo === 'grupo' && !grupoId) return toast('erro', 'Selecione o grupo.');
    setAplicando(true);
    try {
      const r = await api.post<{ afetadas: number }>('/empresa-obrigacoes/alocar-massa', {
        empresaIds: [...sel],
        obrigacaoId: modo === 'obrigacao' ? obrigacaoId : undefined,
        grupoId: modo === 'grupo' ? grupoId : undefined,
      });
      toast('ok', `Alocado em ${r.afetadas} empresa(s).`);
      setSel(new Set());
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setAplicando(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Alocacao em massa</h1>

      <div className="card space-y-3 p-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={modo === 'obrigacao'} onChange={() => setModo('obrigacao')} /> Obrigacao avulsa
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={modo === 'grupo'} onChange={() => setModo('grupo')} /> Grupo de obrigacoes
          </label>
        </div>
        {modo === 'obrigacao' ? (
          <select className="input" value={obrigacaoId} onChange={(e) => setObrigacaoId(e.target.value)}>
            <option value="">Selecione a obrigacao</option>
            {obrigacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        ) : (
          <select className="input" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">Selecione o grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome} ({g.obrigacoes.length})</option>)}
          </select>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Buscar empresa</label>
            <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div>
            <label className="label">Tag</label>
            <select className="input" value={filtroTag} onChange={(e) => setFiltroTag(e.target.value)}>
              <option value="">Todas</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <button className="btn-ghost border border-slate-300" onClick={selecionarTodos}>Selecionar todas</button>
        </div>

        <div className="max-h-96 overflow-y-auto rounded border border-slate-200">
          {empresas.map((e) => (
            <label key={e.id} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} />
              <span className="font-medium text-slate-700">{e.razaoSocial}</span>
            </label>
          ))}
          {empresas.length === 0 && <p className="px-3 py-6 text-center text-slate-400">Nenhuma empresa.</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={aplicar} disabled={aplicando}>
          {aplicando ? 'Aplicando...' : `Aplicar em ${sel.size} empresa(s)`}
        </button>
        {sel.size > 0 && <button className="btn-ghost" onClick={() => setSel(new Set())}>Limpar selecao</button>}
      </div>
    </div>
  );
}
