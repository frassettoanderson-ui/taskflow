import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Badge, useToast } from '../components/ui';
import type { Tag } from '../lib/tipos';

export default function Tags() {
  const navigate = useNavigate();
  const toast = useToast();
  const { sessao } = useAuth();
  const podeTag = temPermissao(sessao, 'empresas_editar');

  const [tags, setTags] = useState<Tag[]>([]);
  const [nova, setNova] = useState({ nome: '', cor: '#64748b' });

  function carregar() { api.get<Tag[]>('/tags').then(setTags).catch(() => setTags([])); }
  useEffect(carregar, []);

  async function add() {
    if (!nova.nome.trim()) return;
    try { await api.post('/tags', nova); setNova({ nome: '', cor: '#64748b' }); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function del(id: string) {
    try { await api.del(`/tags/${id}`); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate('/cadastros')} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-marca-600">
        <ArrowLeft size={15} /> Departamentos
      </button>
      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-slate-800">Etiquetas (tags) das empresas</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t.id} className="flex items-center gap-1">
              <Badge cor={t.cor}>{t.nome} {t.qtdEmpresas ? `(${t.qtdEmpresas})` : ''}</Badge>
              {podeTag && <button className="text-xs text-red-400 hover:text-red-600" onClick={() => del(t.id)}>✕</button>}
            </span>
          ))}
          {tags.length === 0 && <span className="text-slate-400">Nenhuma tag.</span>}
        </div>
        {podeTag && (
          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <input className="input flex-1" placeholder="Nova tag" value={nova.nome} onChange={(e) => setNova((t) => ({ ...t, nome: e.target.value }))} />
            <input type="color" className="h-10 w-12 rounded border border-slate-300" value={nova.cor} onChange={(e) => setNova((t) => ({ ...t, cor: e.target.value }))} />
            <button className="btn-primary" onClick={add}>Adicionar</button>
          </div>
        )}
      </section>
    </div>
  );
}
