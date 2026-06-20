import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Plus, Trash2, Pencil } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Modal, Spinner, useToast } from '../../components/ui';
import type { Indicador, Departamento, GrupoEmpresa } from '../../lib/tipos';

interface Catalogo { metricas: { id: string; nome: string }[]; prazos: { id: string; nome: string }[] }

const TIPOS = [
  { id: 'numerico', nome: 'Numerico (total)' },
  { id: 'colaborador', nome: 'Por colaborador' },
  { id: 'departamento', nome: 'Por departamento' },
];

export default function Indicadores() {
  const toast = useToast();
  const [lista, setLista] = useState<Indicador[]>([]);
  const [cat, setCat] = useState<Catalogo>({ metricas: [], prazos: [] });
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [editar, setEditar] = useState<Indicador | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<Indicador[]>('/dashboard/indicadores').then(setLista).finally(() => setLoading(false));
  }
  useEffect(() => {
    carregar();
    api.get<Catalogo>('/dashboard/catalogo').then(setCat).catch(() => undefined);
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
  }, []);

  async function remover(i: Indicador) {
    if (!confirm(`Excluir o indicador "${i.nome}"?`)) return;
    try { await api.del(`/dashboard/indicadores/${i.id}`); toast('ok', 'Indicador excluido.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  const nomeMetrica = (id: string) => cat.metricas.find((m) => m.id === id)?.nome ?? id;
  const nomePrazo = (id: string) => cat.prazos.find((p) => p.id === id)?.nome ?? id;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800"><Gauge size={22} /> Cadastro de Indicadores</h1>
          <p className="text-sm text-slate-500">Defina os indicadores que comporao seus paineis. <Link to="/dashboard/paineis" className="text-marca-600 hover:underline">Ir para Paineis</Link></p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setNovo(true)}><Plus size={16} /> Novo indicador</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Metrica</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">Visibilidade</th><th className="px-3 py-2">Status</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-marca-700">{i.nome}</td>
                <td className="px-3 py-2 text-slate-500">{TIPOS.find((t) => t.id === i.tipo)?.nome}</td>
                <td className="px-3 py-2 text-slate-500">{nomeMetrica(i.metrica)}</td>
                <td className="px-3 py-2 text-slate-500">{nomePrazo(i.prazo)}</td>
                <td className="px-3 py-2 text-slate-500">{i.visibilidade === 'somente_meu' ? 'Somente meu' : 'Todos'}</td>
                <td className="px-3 py-2">{i.ativo ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Ativo</span> : <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Inativo</span>}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-slate-400 hover:text-marca-600" onClick={() => setEditar(i)}><Pencil size={16} /></button>
                    <button className="text-slate-400 hover:text-red-500" onClick={() => remover(i)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Nenhum indicador cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {(novo || editar) && (
        <IndicadorForm
          inicial={editar}
          catalogo={cat}
          departamentos={departamentos}
          grupos={grupos}
          onFechar={() => { setNovo(false); setEditar(null); }}
          onFeito={() => { setNovo(false); setEditar(null); carregar(); }}
        />
      )}
    </div>
  );
}

function IndicadorForm({ inicial, catalogo, departamentos, grupos, onFechar, onFeito }: {
  inicial: Indicador | null; catalogo: Catalogo; departamentos: Departamento[]; grupos: GrupoEmpresa[]; onFechar: () => void; onFeito: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({
    nome: inicial?.nome ?? '',
    tipo: inicial?.tipo ?? 'numerico',
    metrica: inicial?.metrica ?? (catalogo.metricas[0]?.id ?? 'entregas_baixadas'),
    prazo: inicial?.prazo ?? 'mes_atual',
    visibilidade: inicial?.visibilidade ?? 'todos',
    ativo: inicial?.ativo ?? true,
    filtroDepartamentoId: inicial?.filtroDepartamentoId ?? '',
    filtroGrupoId: inicial?.filtroGrupoId ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function salvar() {
    if (!f.nome.trim()) return toast('erro', 'Informe o nome.');
    setSalvando(true);
    const payload = { ...f, filtroDepartamentoId: f.filtroDepartamentoId || null, filtroGrupoId: f.filtroGrupoId || null };
    try {
      if (inicial) await api.put(`/dashboard/indicadores/${inicial.id}`, payload);
      else await api.post('/dashboard/indicadores', payload);
      toast('ok', 'Indicador salvo.'); onFeito();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={inicial ? 'Editar indicador' : 'Novo indicador'} onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Nome</label><input className="input" value={f.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Entregas do mes" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={f.tipo} onChange={(e) => set('tipo', e.target.value as never)}>
              {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Metrica</label>
            <select className="input" value={f.metrica} onChange={(e) => set('metrica', e.target.value)}>
              {catalogo.metricas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prazo</label>
            <select className="input" value={f.prazo} onChange={(e) => set('prazo', e.target.value as never)}>
              {catalogo.prazos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Visibilidade</label>
            <select className="input" value={f.visibilidade} onChange={(e) => set('visibilidade', e.target.value as never)}>
              <option value="todos">Todos os usuarios</option>
              <option value="somente_meu">Somente eu</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Filtro: departamento</label>
            <select className="input" value={f.filtroDepartamentoId} onChange={(e) => set('filtroDepartamentoId', e.target.value)}>
              <option value="">Todos</option>
              {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Filtro: grupo de empresas</label>
            <select className="input" value={f.filtroGrupoId} onChange={(e) => set('filtroGrupoId', e.target.value)}>
              <option value="">Todos</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={f.ativo} onChange={(e) => set('ativo', e.target.checked)} /> Indicador ativo
        </label>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}
