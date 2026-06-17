import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type { TemplateEmail } from '../../lib/tipos';

const TIPOS = ['ENTREGA', 'LEMBRETE', 'COMUNICADO', 'GENERICO'] as const;
const VARS = '{{empresa}} {{obrigacao}} {{competencia}} {{contato}} {{link_protocolo}}';

export default function Templates() {
  const { sessao } = useAuth();
  const toast = useToast();
  const pode = temPermissao(sessao, 'portal_configurar');
  const [itens, setItens] = useState<TemplateEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<TemplateEmail | null>(null);
  const [novo, setNovo] = useState(false);

  function carregar() { setLoading(true); api.get<TemplateEmail[]>('/comunicacao/templates').then(setItens).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  async function excluir(t: TemplateEmail) {
    if (!confirm('Excluir template?')) return;
    try { await api.del(`/comunicacao/templates/${t.id}`); carregar(); } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Templates de E-mail</h1>
        {pode && <button className="btn-primary" onClick={() => setNovo(true)}>+ Novo template</button>}
      </div>
      <p className="text-sm text-slate-500">Variaveis disponiveis: <code>{VARS}</code></p>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Assunto</th><th></th></tr>
          </thead>
          <tbody>
            {itens.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{t.nome}</td>
                <td className="px-3 py-2"><Badge className="bg-slate-100 text-slate-600">{t.tipo}</Badge></td>
                <td className="px-3 py-2 text-slate-500">{t.assunto}</td>
                <td className="px-3 py-2 text-right">{pode && <span className="flex justify-end gap-2 text-xs"><button className="text-marca-600 hover:underline" onClick={() => setEditando(t)}>editar</button><button className="text-red-500 hover:underline" onClick={() => excluir(t)}>excluir</button></span>}</td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-400">Nenhum template.</td></tr>}
          </tbody>
        </table>
      </div>
      {(novo || editando) && <TplModal t={editando} onFechar={() => { setNovo(false); setEditando(null); }} onSalvo={() => { setNovo(false); setEditando(null); carregar(); }} />}
    </div>
  );
}

function TplModal({ t, onFechar, onSalvo }: { t: TemplateEmail | null; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ tipo: t?.tipo ?? 'GENERICO', nome: t?.nome ?? '', assunto: t?.assunto ?? '', corpo: t?.corpo ?? '' });
  async function salvar() {
    try {
      if (t) await api.put(`/comunicacao/templates/${t.id}`, f); else await api.post('/comunicacao/templates', f);
      toast('ok', 'Salvo.'); onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  return (
    <Modal aberto titulo={t ? 'Editar template' : 'Novo template'} onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nome</label><input className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div><label className="label">Tipo</label><select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TemplateEmail['tipo'] })}>{TIPOS.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        </div>
        <div><label className="label">Assunto</label><input className="input" value={f.assunto} onChange={(e) => setF({ ...f, assunto: e.target.value })} /></div>
        <div><label className="label">Corpo</label><textarea className="input font-mono text-xs" rows={8} value={f.corpo} onChange={(e) => setF({ ...f, corpo: e.target.value })} /></div>
        <p className="text-xs text-slate-400">Variaveis: {VARS}</p>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></div>
      </div>
    </Modal>
  );
}
