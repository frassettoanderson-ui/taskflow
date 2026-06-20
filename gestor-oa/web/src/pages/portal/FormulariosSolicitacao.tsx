import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Trash2, Pencil, GripVertical } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Modal, Spinner, useToast } from '../../components/ui';

type Tipo = 'texto' | 'textarea' | 'numero' | 'data' | 'select';
interface Campo { id: string; label: string; tipo: Tipo; opcoes?: string[]; obrigatorio?: boolean }
interface Formulario { id: string; nome: string; descricao: string | null; ativo: boolean; campos: Campo[] }

const TIPOS: { id: Tipo; nome: string }[] = [
  { id: 'texto', nome: 'Texto curto' }, { id: 'textarea', nome: 'Texto longo' },
  { id: 'numero', nome: 'Numero' }, { id: 'data', nome: 'Data' }, { id: 'select', nome: 'Lista de opcoes' },
];

export default function FormulariosSolicitacao() {
  const toast = useToast();
  const [lista, setLista] = useState<Formulario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editar, setEditar] = useState<Formulario | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() { setLoading(true); api.get<Formulario[]>('/gestao-portal/formularios').then(setLista).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  async function remover(f: Formulario) {
    if (!confirm(`Excluir o formulario "${f.nome}"?`)) return;
    try { await api.del(`/gestao-portal/formularios/${f.id}`); toast('ok', 'Formulario excluido.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800"><ClipboardList size={22} /> Formularios de Solicitacao</h1>
          <p className="text-sm text-slate-500">Campos estruturados que o cliente preenche ao abrir uma solicitacao na Area VIP.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setNovo(true)}><Plus size={16} /> Novo formulario</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((f) => (
          <div key={f.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between">
              <h2 className="font-semibold text-marca-700">{f.nome}</h2>
              <div className="flex gap-1">
                <button className="text-slate-400 hover:text-marca-600" onClick={() => setEditar(f)}><Pencil size={15} /></button>
                <button className="text-slate-400 hover:text-red-500" onClick={() => remover(f)}><Trash2 size={15} /></button>
              </div>
            </div>
            {f.descricao && <p className="text-xs text-slate-500">{f.descricao}</p>}
            <p className="text-xs text-slate-400">{f.campos.length} campo(s){f.ativo ? '' : ' · inativo'}</p>
            <div className="flex flex-wrap gap-1">{f.campos.map((c) => <span key={c.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{c.label}</span>)}</div>
          </div>
        ))}
        {lista.length === 0 && <p className="col-span-full py-10 text-center text-slate-400">Nenhum formulario cadastrado.</p>}
      </div>

      {(novo || editar) && <FormEditor inicial={editar} onFechar={() => { setNovo(false); setEditar(null); }} onFeito={() => { setNovo(false); setEditar(null); carregar(); }} />}
    </div>
  );
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function FormEditor({ inicial, onFechar, onFeito }: { inicial: Formulario | null; onFechar: () => void; onFeito: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [campos, setCampos] = useState<Campo[]>(inicial?.campos ?? []);
  const [salvando, setSalvando] = useState(false);

  function addCampo() { setCampos((c) => [...c, { id: uid(), label: '', tipo: 'texto', obrigatorio: false }]); }
  function upd(id: string, patch: Partial<Campo>) { setCampos((c) => c.map((x) => x.id === id ? { ...x, ...patch } : x)); }
  function del(id: string) { setCampos((c) => c.filter((x) => x.id !== id)); }

  async function salvar() {
    if (!nome.trim()) return toast('erro', 'Informe o nome.');
    const limpos = campos.filter((c) => c.label.trim()).map((c) => ({ ...c, opcoes: c.tipo === 'select' ? (c.opcoes ?? []).filter(Boolean) : undefined }));
    if (limpos.length === 0) return toast('erro', 'Adicione ao menos um campo.');
    setSalvando(true);
    const payload = { nome: nome.trim(), descricao: descricao || null, ativo, campos: limpos };
    try {
      if (inicial) await api.put(`/gestao-portal/formularios/${inicial.id}`, payload);
      else await api.post('/gestao-portal/formularios', payload);
      toast('ok', 'Formulario salvo.'); onFeito();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={inicial ? 'Editar formulario' : 'Novo formulario'} onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Abertura de empresa" /></div>
        <div><label className="label">Descricao (opcional)</label><input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>

        <div>
          <div className="mb-1 flex items-center justify-between"><label className="label mb-0">Campos</label><button className="text-sm text-marca-600 hover:underline" onClick={addCampo}>+ Adicionar campo</button></div>
          <div className="space-y-2">
            {campos.map((c) => (
              <div key={c.id} className="rounded border border-slate-200 p-2">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-slate-300" />
                  <input className="input flex-1" placeholder="Rotulo do campo" value={c.label} onChange={(e) => upd(c.id, { label: e.target.value })} />
                  <select className="input w-36" value={c.tipo} onChange={(e) => upd(c.id, { tipo: e.target.value as Tipo })}>
                    {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button className="text-slate-400 hover:text-red-500" onClick={() => del(c.id)}><Trash2 size={15} /></button>
                </div>
                {c.tipo === 'select' && (
                  <input className="input mt-2" placeholder="Opcoes separadas por virgula" value={(c.opcoes ?? []).join(', ')} onChange={(e) => upd(c.id, { opcoes: e.target.value.split(',').map((s) => s.trim()) })} />
                )}
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={!!c.obrigatorio} onChange={(e) => upd(c.id, { obrigatorio: e.target.checked })} /> Obrigatorio</label>
              </div>
            ))}
            {campos.length === 0 && <p className="text-sm text-slate-400">Nenhum campo. Clique em "+ Adicionar campo".</p>}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Formulario ativo (disponivel ao cliente)</label>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button></div>
      </div>
    </Modal>
  );
}
