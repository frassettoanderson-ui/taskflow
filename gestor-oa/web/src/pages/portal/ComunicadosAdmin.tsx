import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';

interface Comunicado { id: string; titulo: string; conteudo: string; ativo: boolean; createdAt: string }

export default function ComunicadosAdmin() {
  const { sessao } = useAuth();
  const toast = useToast();
  const pode = temPermissao(sessao, 'portal_comunicados');
  const [itens, setItens] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Comunicado | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() { setLoading(true); api.get<Comunicado[]>('/gestao-portal/comunicados').then(setItens).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  async function excluir(c: Comunicado) {
    if (!confirm('Excluir comunicado?')) return;
    try { await api.del(`/gestao-portal/comunicados/${c.id}`); carregar(); } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Comunicados</h1>
        {pode && <button className="btn-primary" onClick={() => setNovo(true)}>+ Novo comunicado</button>}
      </div>
      <div className="space-y-3">
        {itens.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">{c.titulo}</h2>
              <div className="flex items-center gap-2">
                {c.ativo ? <Badge className="bg-emerald-100 text-emerald-700">Ativo</Badge> : <Badge className="bg-slate-200 text-slate-600">Inativo</Badge>}
                {pode && <button className="text-xs text-marca-600 hover:underline" onClick={() => setEditando(c)}>editar</button>}
                {pode && <button className="text-xs text-red-500 hover:underline" onClick={() => excluir(c)}>excluir</button>}
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{c.conteudo}</p>
          </div>
        ))}
        {itens.length === 0 && <p className="text-slate-400">Nenhum comunicado.</p>}
      </div>
      {(novo || editando) && <ComunicadoModal c={editando} onFechar={() => { setNovo(false); setEditando(null); }} onSalvo={() => { setNovo(false); setEditando(null); carregar(); }} />}
    </div>
  );
}

function ComunicadoModal({ c, onFechar, onSalvo }: { c: Comunicado | null; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [titulo, setTitulo] = useState(c?.titulo ?? '');
  const [conteudo, setConteudo] = useState(c?.conteudo ?? '');
  async function salvar() {
    try {
      if (c) await api.put(`/gestao-portal/comunicados/${c.id}`, { titulo, conteudo });
      else await api.post('/gestao-portal/comunicados', { titulo, conteudo });
      toast('ok', 'Salvo.'); onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  return (
    <Modal aberto titulo={c ? 'Editar comunicado' : 'Novo comunicado'} onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Titulo</label><input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label className="label">Conteudo</label><textarea className="input" rows={5} value={conteudo} onChange={(e) => setConteudo(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></div>
      </div>
    </Modal>
  );
}
