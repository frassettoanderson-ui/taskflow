import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type { AssinaturaDocumento, Obrigacao } from '../../lib/tipos';

export default function Assinaturas() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [itens, setItens] = useState<AssinaturaDocumento[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<AssinaturaDocumento | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<AssinaturaDocumento[]>('/assinaturas').then(setItens).finally(() => setLoading(false));
  }
  useEffect(() => {
    carregar();
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
  }, []);

  async function excluir(a: AssinaturaDocumento) {
    if (!confirm(`Excluir assinatura "${a.nome}"?`)) return;
    try { await api.del(`/assinaturas/${a.id}`); toast('ok', 'Excluida.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Assinaturas de Documento</h1>
        {podeGerenciar && <button className="btn-primary" onClick={() => setNovo(true)}>+ Nova assinatura</button>}
      </div>
      <p className="text-sm text-slate-500">Regras que ensinam o robo a reconhecer cada tipo de guia (palavras-chave/regex) e extrair a competencia.</p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Obrigacao alvo</th><th className="px-3 py-2">Palavras-chave</th><th className="px-3 py-2">Ativa</th><th></th></tr>
          </thead>
          <tbody>
            {itens.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{a.nome}</td>
                <td className="px-3 py-2 text-slate-500">{a.obrigacaoNome}</td>
                <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{a.palavras.map((p, i) => <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{p}</span>)}</div></td>
                <td className="px-3 py-2">{a.ativo ? <Badge className="bg-emerald-100 text-emerald-700">Sim</Badge> : <Badge className="bg-slate-200 text-slate-600">Nao</Badge>}</td>
                <td className="px-3 py-2 text-right">
                  {podeGerenciar && (
                    <div className="flex justify-end gap-2 text-xs">
                      <button className="text-marca-600 hover:underline" onClick={() => setEditando(a)}>editar</button>
                      <button className="text-red-500 hover:underline" onClick={() => excluir(a)}>excluir</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Nenhuma assinatura.</td></tr>}
          </tbody>
        </table>
      </div>

      {(novo || editando) && (
        <AssinaturaModal assinatura={editando} obrigacoes={obrigacoes} onFechar={() => { setNovo(false); setEditando(null); }} onSalvo={() => { setNovo(false); setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

function AssinaturaModal({ assinatura, obrigacoes, onFechar, onSalvo }: {
  assinatura: AssinaturaDocumento | null; obrigacoes: Obrigacao[]; onFechar: () => void; onSalvo: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(assinatura?.nome ?? '');
  const [obrigacaoNome, setObrigacaoNome] = useState(assinatura?.obrigacaoNome ?? '');
  const [palavras, setPalavras] = useState((assinatura?.palavras ?? []).join('\n'));
  const [regexCompetencia, setRegexCompetencia] = useState(assinatura?.regexCompetencia ?? '');
  const [ativo, setAtivo] = useState(assinatura?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const payload = {
        nome, obrigacaoNome,
        palavras: palavras.split('\n').map((p) => p.trim()).filter(Boolean),
        regexCompetencia: regexCompetencia || null, ativo,
      };
      if (assinatura) await api.put(`/assinaturas/${assinatura.id}`, payload);
      else await api.post('/assinaturas', payload);
      toast('ok', 'Assinatura salva.');
      onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={assinatura ? 'Editar assinatura' : 'Nova assinatura'} onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div>
          <label className="label">Obrigacao alvo</label>
          <select className="input" value={obrigacaoNome} onChange={(e) => setObrigacaoNome(e.target.value)}>
            <option value="">Selecione</option>
            {obrigacoes.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Palavras-chave / regex (uma por linha — todas devem casar)</label>
          <textarea className="input font-mono text-xs" rows={4} value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder={'DARF\nSimples Nacional'} />
        </div>
        <div>
          <label className="label">Regex da competencia (opcional)</label>
          <input className="input font-mono text-xs" value={regexCompetencia} onChange={(e) => setRegexCompetencia(e.target.value)} placeholder="periodo de apuracao\\s*:?\\s*(\\d{2}/\\d{4})" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativa</label>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}
