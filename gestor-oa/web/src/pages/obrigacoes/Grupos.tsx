import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Modal, Spinner, useToast } from '../../components/ui';
import { SeletorObrigacoes } from './SeletorObrigacoes';
import type { Grupo, Obrigacao } from '../../lib/tipos';

export default function Grupos() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Grupo | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<Grupo[]>('/grupos').then(setGrupos).finally(() => setLoading(false));
  }
  useEffect(() => {
    carregar();
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
  }, []);

  async function excluir(g: Grupo) {
    if (!confirm(`Excluir o grupo "${g.nome}"?`)) return;
    try { await api.del(`/grupos/${g.id}`); toast('ok', 'Grupo excluido.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Grupos de Obrigacoes</h1>
        {podeGerenciar && <button className="btn-primary" onClick={() => setNovo(true)}>+ Novo grupo</button>}
      </div>
      <p className="text-sm text-slate-500">
        Aplicar um grupo a uma empresa apenas <strong>adiciona</strong> as obrigacoes (nao remove nada). Ideal para o fluxo colaborativo entre departamentos.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <div key={g.id} className="card p-5">
            <h2 className="font-semibold text-slate-700">{g.nome}</h2>
            <div className="mt-2 text-sm text-slate-500">{g.obrigacoes.length} obrigacoes</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {g.obrigacoes.slice(0, 8).map((o) => (
                <span key={o.obrigacaoId} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{o.obrigacao.nome}</span>
              ))}
            </div>
            {podeGerenciar && (
              <div className="mt-3 flex gap-2 text-sm">
                <button className="text-marca-600 hover:underline" onClick={() => setEditando(g)}>editar</button>
                <button className="text-red-500 hover:underline" onClick={() => excluir(g)}>excluir</button>
              </div>
            )}
          </div>
        ))}
        {grupos.length === 0 && <p className="text-slate-400">Nenhum grupo cadastrado.</p>}
      </div>

      {(novo || editando) && (
        <GrupoModal
          grupo={editando}
          obrigacoes={obrigacoes}
          onFechar={() => { setNovo(false); setEditando(null); }}
          onSalvo={() => { setNovo(false); setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}

function GrupoModal({
  grupo, obrigacoes, onFechar, onSalvo,
}: { grupo: Grupo | null; obrigacoes: Obrigacao[]; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(grupo?.nome ?? '');
  const [sel, setSel] = useState<Set<string>>(new Set(grupo?.obrigacoes.map((o) => o.obrigacaoId) ?? []));
  const [salvando, setSalvando] = useState(false);

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const payload = { nome, obrigacaoIds: [...sel] };
      if (grupo) await api.put(`/grupos/${grupo.id}`, payload);
      else await api.post('/grupos', payload);
      toast('ok', 'Grupo salvo.');
      onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={grupo ? 'Editar grupo' : 'Novo grupo'} onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="label">Nome *</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="label">Obrigacoes do grupo ({sel.size})</label>
          <SeletorObrigacoes obrigacoes={obrigacoes} selecionados={sel} onToggle={toggle} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}
