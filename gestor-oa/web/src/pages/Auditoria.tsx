import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Badge, Spinner } from '../components/ui';
import type { LogAuditoriaItem, UsuarioCompleto } from '../lib/tipos';

interface Pagina { items: LogAuditoriaItem[]; total: number; totalPages: number; page: number }

const CORES_ACAO: Record<string, string> = { CREATE: '#88b87f', UPDATE: '#ffb752', DELETE: '#d15b47' };

export default function Auditoria() {
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([]);
  const [entidades, setEntidades] = useState<string[]>([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [entidade, setEntidade] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [page, setPage] = useState(1);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    api.get<UsuarioCompleto[]>('/usuarios').then(setUsuarios).catch(() => undefined);
    api.get<string[]>('/auditoria/entidades').then(setEntidades).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '50' });
    if (usuarioId) qs.set('usuarioId', usuarioId);
    if (entidade) qs.set('entidade', entidade);
    if (de) qs.set('de', de);
    if (ate) qs.set('ate', ate);
    api.get<Pagina>(`/auditoria?${qs}`).then(setPagina).finally(() => setLoading(false));
  }, [usuarioId, entidade, de, ate, page]);
  useEffect(() => setPage(1), [usuarioId, entidade, de, ate]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Auditoria</h1>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Usuario</label>
          <select className="input" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Entidade</label>
          <select className="input" value={entidade} onChange={(e) => setEntidade(e.target.value)}>
            <option value="">Todas</option>
            {entidades.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div><label className="label">De</label><input type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><label className="label">Ate</label><input type="date" className="input" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <Spinner /> : (
          <div className="divide-y divide-slate-100">
            {(pagina?.items ?? []).map((l) => (
              <div key={l.id}>
                <button
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => setAberto(aberto === l.id ? null : l.id)}
                >
                  <Badge cor={CORES_ACAO[l.acao] ?? '#94a3b8'}>{l.acao}</Badge>
                  <span className="font-medium text-slate-700">{l.entidade}</span>
                  <span className="text-slate-500">por {l.usuario?.nome ?? 'Sistema'}</span>
                  <span className="ml-auto text-xs text-slate-400">{new Date(l.createdAt).toLocaleString('pt-BR')}</span>
                </button>
                {aberto === l.id && (
                  <div className="grid grid-cols-1 gap-3 bg-slate-50 px-4 py-3 text-xs sm:grid-cols-2">
                    <div>
                      <div className="mb-1 font-medium text-slate-500">Antes</div>
                      <pre className="max-h-48 overflow-auto rounded bg-white p-2 text-[11px]">{l.antes ? JSON.stringify(l.antes, null, 2) : '—'}</pre>
                    </div>
                    <div>
                      <div className="mb-1 font-medium text-slate-500">Depois</div>
                      <pre className="max-h-48 overflow-auto rounded bg-white p-2 text-[11px]">{l.depois ? JSON.stringify(l.depois, null, 2) : '—'}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(pagina?.items.length ?? 0) === 0 && <p className="px-4 py-10 text-center text-slate-400">Nenhum registro.</p>}
          </div>
        )}
      </div>

      {pagina && pagina.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span className="text-slate-500">Pagina {pagina.page} de {pagina.totalPages}</span>
          <button className="btn-ghost" disabled={page >= pagina.totalPages} onClick={() => setPage((p) => p + 1)}>Proxima</button>
        </div>
      )}
    </div>
  );
}
