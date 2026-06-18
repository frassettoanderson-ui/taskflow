import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Badge, useToast } from '../components/ui';
import type { Departamento, Tag } from '../lib/tipos';

export default function Cadastros() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeDep = temPermissao(sessao, 'admin_escritorio');
  const podeTag = temPermissao(sessao, 'empresas_editar');

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [novoDep, setNovoDep] = useState({ nome: '', cor: '#0f5c5e', responsavelId: '' });
  const [novaTag, setNovaTag] = useState({ nome: '', cor: '#64748b' });

  function carregar() {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
    api.get<{ id: string; nome: string }[]>('/usuarios').then(setUsuarios).catch(() => undefined);
  }
  useEffect(carregar, []);

  async function addDep() {
    if (!novoDep.nome.trim()) return;
    try {
      await api.post('/departamentos', { ...novoDep, responsavelId: novoDep.responsavelId || null });
      setNovoDep({ nome: '', cor: '#0f5c5e', responsavelId: '' });
      carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function toggleDep(d: Departamento) {
    try { await api.put(`/departamentos/${d.id}`, { ativo: !d.ativo }); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function setRespDep(d: Departamento, responsavelId: string) {
    try { await api.put(`/departamentos/${d.id}`, { responsavelId: responsavelId || null }); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function addTag() {
    if (!novaTag.nome.trim()) return;
    try {
      await api.post('/tags', novaTag);
      setNovaTag({ nome: '', cor: '#64748b' });
      carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function delTag(id: string) {
    try { await api.del(`/tags/${id}`); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-slate-800">Departamentos</h2>
        <div className="divide-y divide-slate-100">
          {departamentos.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: d.cor }} />
                {d.nome}
              </span>
              <div className="flex items-center gap-2">
                {podeDep ? (
                  <select
                    className="input h-8 w-44 py-0 text-xs"
                    value={d.responsavelId ?? ''}
                    onChange={(e) => setRespDep(d, e.target.value)}
                    title="Responsavel do departamento"
                  >
                    <option value="">(sem responsavel)</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                ) : (
                  <span className="text-xs text-slate-400">{usuarios.find((u) => u.id === d.responsavelId)?.nome ?? '—'}</span>
                )}
                {podeDep && (
                  <button className="text-sm text-slate-500 hover:underline" onClick={() => toggleDep(d)}>
                    {d.ativo ? 'ativo' : 'inativo'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {podeDep && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <input className="input flex-1" placeholder="Novo departamento" value={novoDep.nome} onChange={(e) => setNovoDep((d) => ({ ...d, nome: e.target.value }))} />
            <input type="color" className="h-10 w-12 rounded border border-slate-300" value={novoDep.cor} onChange={(e) => setNovoDep((d) => ({ ...d, cor: e.target.value }))} />
            <select className="input w-44" value={novoDep.responsavelId} onChange={(e) => setNovoDep((d) => ({ ...d, responsavelId: e.target.value }))}>
              <option value="">Responsavel...</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
            <button className="btn-primary" onClick={addDep}>Adicionar</button>
          </div>
        )}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-slate-800">Tags</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t.id} className="flex items-center gap-1">
              <Badge cor={t.cor}>{t.nome} {t.qtdEmpresas ? `(${t.qtdEmpresas})` : ''}</Badge>
              {podeTag && <button className="text-xs text-red-400 hover:text-red-600" onClick={() => delTag(t.id)}>✕</button>}
            </span>
          ))}
          {tags.length === 0 && <span className="text-slate-400">Nenhuma tag.</span>}
        </div>
        {podeTag && (
          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <input className="input flex-1" placeholder="Nova tag" value={novaTag.nome} onChange={(e) => setNovaTag((t) => ({ ...t, nome: e.target.value }))} />
            <input type="color" className="h-10 w-12 rounded border border-slate-300" value={novaTag.cor} onChange={(e) => setNovaTag((t) => ({ ...t, cor: e.target.value }))} />
            <button className="btn-primary" onClick={addTag}>Adicionar</button>
          </div>
        )}
      </section>
    </div>
  );
}
