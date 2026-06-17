import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Modal, Spinner, useToast } from '../../components/ui';
import { SeletorObrigacoes } from './SeletorObrigacoes';
import type { Regime, Obrigacao } from '../../lib/tipos';

export default function Regimes() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Regime | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<Regime[]>('/regimes').then(setRegimes).finally(() => setLoading(false));
  }
  useEffect(() => {
    carregar();
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
  }, []);

  async function excluir(r: Regime) {
    if (!confirm(`Excluir o regime "${r.nome}"?`)) return;
    try { await api.del(`/regimes/${r.id}`); toast('ok', 'Regime excluido.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Regimes Tributarios</h1>
        {podeGerenciar && <button className="btn-primary" onClick={() => setNovo(true)}>+ Novo regime</button>}
      </div>
      <p className="text-sm text-slate-500">
        Atribuir um regime a uma empresa <strong>substitui</strong> as obrigacoes de origem "regime" (nao mexe nas de grupo/manual).
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {regimes.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">{r.nome}</h2>
              <span className="text-xs text-slate-400">{r._count?.empresas ?? 0} empresa(s)</span>
            </div>
            <div className="mt-2 text-sm text-slate-500">{r.obrigacoes.length} obrigacoes vinculadas</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {r.obrigacoes.slice(0, 8).map((o) => (
                <span key={o.obrigacaoId} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{o.obrigacao.nome}</span>
              ))}
              {r.obrigacoes.length > 8 && <span className="text-xs text-slate-400">+{r.obrigacoes.length - 8}</span>}
            </div>
            {podeGerenciar && (
              <div className="mt-3 flex gap-2 text-sm">
                <button className="text-marca-600 hover:underline" onClick={() => setEditando(r)}>editar</button>
                <button className="text-red-500 hover:underline" onClick={() => excluir(r)}>excluir</button>
              </div>
            )}
          </div>
        ))}
        {regimes.length === 0 && <p className="text-slate-400">Nenhum regime cadastrado.</p>}
      </div>

      {(novo || editando) && (
        <RegimeModal
          regime={editando}
          obrigacoes={obrigacoes}
          onFechar={() => { setNovo(false); setEditando(null); }}
          onSalvo={() => { setNovo(false); setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}

function RegimeModal({
  regime, obrigacoes, onFechar, onSalvo,
}: { regime: Regime | null; obrigacoes: Obrigacao[]; onFechar: () => void; onSalvo: () => void }) {
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
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}
