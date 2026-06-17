import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Modal, Spinner, useToast } from '../../components/ui';
import type { Matriz, MatrizPasso, Departamento, Obrigacao, AcaoAutomatica } from '../../lib/tipos';

const ACOES: { v: AcaoAutomatica; label: string }[] = [
  { v: 'NENHUMA', label: 'Nenhuma' },
  { v: 'CRIAR_TAREFA', label: 'Criar tarefa' },
  { v: 'CRIAR_OBRIGACAO_NA_EMPRESA', label: 'Criar obrigacao na empresa' },
  { v: 'INICIAR_SUBPROCESSO', label: 'Iniciar subprocesso' },
];

export default function Matrizes() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'processos_gerenciar_matrizes');
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Matriz | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() { setLoading(true); api.get<Matriz[]>('/matrizes').then(setMatrizes).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  async function excluir(m: Matriz) {
    if (!confirm(`Excluir matriz "${m.nome}"?`)) return;
    try { await api.del(`/matrizes/${m.id}`); toast('ok', 'Excluida.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Matrizes de Processo</h1>
        {podeGerenciar && <button className="btn-primary" onClick={() => setNovo(true)}>+ Nova matriz</button>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {matrizes.map((m) => (
          <div key={m.id} className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">{m.nome}</h2>
              <span className="text-xs text-slate-400">{m._count?.processos ?? 0} processo(s)</span>
            </div>
            {m.descricao && <p className="mt-1 text-sm text-slate-500">{m.descricao}</p>}
            <div className="mt-2 text-sm text-slate-500">{m.passos.length} passos</div>
            {podeGerenciar && (
              <div className="mt-3 flex gap-2 text-sm">
                <button className="text-marca-600 hover:underline" onClick={() => setEditando(m)}>editar</button>
                <button className="text-red-500 hover:underline" onClick={() => excluir(m)}>excluir</button>
              </div>
            )}
          </div>
        ))}
        {matrizes.length === 0 && <p className="text-slate-400">Nenhuma matriz.</p>}
      </div>

      {(novo || editando) && (
        <MatrizModal matriz={editando} onFechar={() => { setNovo(false); setEditando(null); }} onSalvo={() => { setNovo(false); setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

function MatrizModal({ matriz, onFechar, onSalvo }: { matriz: Matriz | null; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(matriz?.nome ?? '');
  const [descricao, setDescricao] = useState(matriz?.descricao ?? '');
  const [passos, setPassos] = useState<MatrizPasso[]>(matriz?.passos ?? []);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [matrizesDisp, setMatrizesDisp] = useState<Matriz[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
    api.get<Matriz[]>('/matrizes').then(setMatrizesDisp).catch(() => undefined);
  }, []);

  function addPasso() {
    setPassos((arr) => [...arr, { ordem: arr.length + 1, titulo: '', prazoDias: 0, basePrazo: 'INICIO', bloqueante: false, acaoAutomatica: 'NENHUMA' }]);
  }
  function setPasso(i: number, patch: Partial<MatrizPasso>) {
    setPassos((arr) => arr.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function removerPasso(i: number) {
    setPassos((arr) => arr.filter((_, j) => j !== i).map((p, idx) => ({ ...p, ordem: idx + 1 })));
  }

  async function salvar() {
    if (!nome.trim()) return toast('erro', 'Informe o nome.');
    setSalvando(true);
    try {
      const payload = { nome, descricao: descricao || null, passos: passos.map((p, i) => ({ ...p, ordem: i + 1, prazoDias: Number(p.prazoDias) })) };
      if (matriz) await api.put(`/matrizes/${matriz.id}`, payload);
      else await api.post('/matrizes', payload);
      toast('ok', 'Matriz salva.');
      onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={matriz ? 'Editar matriz' : 'Nova matriz'} onFechar={onFechar} largura="max-w-3xl">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><label className="label">Descricao</label><input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Passos ({passos.length})</span>
          <button className="btn-ghost border border-slate-300 text-xs" onClick={addPasso}>+ Passo</button>
        </div>

        {passos.map((p, i) => (
          <div key={i} className="space-y-2 rounded-md border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">#{i + 1}</span>
              <input className="input flex-1" placeholder="Titulo do passo" value={p.titulo} onChange={(e) => setPasso(i, { titulo: e.target.value })} />
              <button className="btn-ghost text-xs" onClick={() => removerPasso(i)}>✕</button>
            </div>
            <input className="input" placeholder="Descricao (opcional)" value={p.descricao ?? ''} onChange={(e) => setPasso(i, { descricao: e.target.value })} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select className="input" value={p.departamentoId ?? ''} onChange={(e) => setPasso(i, { departamentoId: e.target.value || null })}>
                <option value="">Departamento</option>
                {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
              <input type="number" className="input" placeholder="Prazo (dias)" value={p.prazoDias} onChange={(e) => setPasso(i, { prazoDias: Number(e.target.value) })} />
              <select className="input" value={p.basePrazo} onChange={(e) => setPasso(i, { basePrazo: e.target.value as MatrizPasso['basePrazo'] })}>
                <option value="INICIO">do inicio</option>
                <option value="PASSO_ANTERIOR">do passo anterior</option>
              </select>
              <label className="flex items-center gap-1 text-sm text-slate-600"><input type="checkbox" checked={p.bloqueante} onChange={(e) => setPasso(i, { bloqueante: e.target.checked })} /> bloqueante</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={p.acaoAutomatica} onChange={(e) => setPasso(i, { acaoAutomatica: e.target.value as AcaoAutomatica, acaoRef: null })}>
                {ACOES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
              {p.acaoAutomatica === 'CRIAR_OBRIGACAO_NA_EMPRESA' && (
                <select className="input" value={p.acaoRef ?? ''} onChange={(e) => setPasso(i, { acaoRef: e.target.value })}>
                  <option value="">Obrigacao...</option>
                  {obrigacoes.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                </select>
              )}
              {p.acaoAutomatica === 'INICIAR_SUBPROCESSO' && (
                <select className="input" value={p.acaoRef ?? ''} onChange={(e) => setPasso(i, { acaoRef: e.target.value })}>
                  <option value="">Matriz...</option>
                  {matrizesDisp.filter((m) => m.id !== matriz?.id).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              )}
              {p.acaoAutomatica === 'CRIAR_TAREFA' && (
                <input className="input" placeholder="Descricao da tarefa" value={p.acaoRef ?? ''} onChange={(e) => setPasso(i, { acaoRef: e.target.value })} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}
