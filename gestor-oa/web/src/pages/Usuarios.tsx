import { useEffect, useState } from 'react';
import { api, ApiError, getAccessToken } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../components/ui';
import type { UsuarioCompleto, Departamento, Tag, JanelaAcesso } from '../lib/tipos';
import { PERMISSION_GROUPS, DIAS_SEMANA_LABEL } from '../lib/tipos';

export default function Usuarios() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeUsuarios = temPermissao(sessao, 'admin_usuarios');
  const podePermissoes = temPermissao(sessao, 'admin_permissoes');

  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<UsuarioCompleto | null>(null);
  const [novo, setNovo] = useState(false);
  const [replicar, setReplicar] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<UsuarioCompleto[]>('/usuarios?incluirInativos=true').then(setUsuarios).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function inativar(u: UsuarioCompleto) {
    if (!confirm(`Inativar ${u.nome}?`)) return;
    try { await api.del(`/usuarios/${u.id}`); toast('ok', 'Usuario inativado.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function resetSenha(u: UsuarioCompleto) {
    const s = prompt(`Nova senha para ${u.nome} (min 8):`);
    if (!s) return;
    try { await api.put(`/usuarios/${u.id}/senha`, { novaSenha: s }); toast('ok', 'Senha redefinida.'); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function exportar() {
    const res = await fetch('/api/v1/usuarios/export', { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'usuarios.csv'; a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Usuarios e Permissoes</h1>
        <div className="flex gap-2">
          <button className="btn-ghost border border-slate-300" onClick={exportar}>Exportar</button>
          {podePermissoes && <button className="btn-ghost border border-slate-300" onClick={() => setReplicar(true)}>Replicar permissoes</button>}
          {podeUsuarios && <button className="btn-primary" onClick={() => setNovo(true)}>+ Novo usuario</button>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Permissoes</th><th className="px-3 py-2">Horarios</th><th className="px-3 py-2">Status</th><th></th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const ativas = Object.values(u.permissoes).filter(Boolean).length;
              return (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{u.nome}</td>
                  <td className="px-3 py-2 text-slate-500">{u.email}</td>
                  <td className="px-3 py-2 text-slate-500">{ativas} ativas</td>
                  <td className="px-3 py-2 text-slate-500">{u.horariosAcesso.length ? `${u.horariosAcesso.length} janela(s)` : 'livre'}</td>
                  <td className="px-3 py-2">{u.ativo ? <Badge className="bg-emerald-100 text-emerald-700">Ativo</Badge> : <Badge className="bg-slate-200 text-slate-600">Inativo</Badge>}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      {podeUsuarios && <button className="text-marca-600 hover:underline" onClick={() => setEditando(u)}>editar</button>}
                      {podeUsuarios && <button className="text-slate-500 hover:underline" onClick={() => resetSenha(u)}>senha</button>}
                      {podeUsuarios && u.ativo && <button className="text-red-500 hover:underline" onClick={() => inativar(u)}>inativar</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(novo || editando) && (
        <UsuarioModal
          usuario={editando}
          podePermissoes={podePermissoes}
          onFechar={() => { setNovo(false); setEditando(null); }}
          onSalvo={() => { setNovo(false); setEditando(null); carregar(); }}
        />
      )}
      {replicar && <ReplicarModal usuarios={usuarios} onFechar={() => setReplicar(false)} onFeito={() => { setReplicar(false); carregar(); }} />}
    </div>
  );
}

type TabKey = 'Dados' | 'Permissoes' | 'Horarios' | 'Filtros';

function UsuarioModal({
  usuario, podePermissoes, onFechar, onSalvo,
}: { usuario: UsuarioCompleto | null; podePermissoes: boolean; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('Dados');
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [senha, setSenha] = useState('');
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>(usuario?.permissoes ?? {});
  const [horarios, setHorarios] = useState<JanelaAcesso[]>(usuario?.horariosAcesso ?? []);
  const [depIds, setDepIds] = useState<string[]>(usuario?.filtrosForcados?.departamentos ?? []);
  const [tagIds, setTagIds] = useState<string[]>(usuario?.filtrosForcados?.tags ?? []);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
  }, []);

  function togglePerm(flag: string) {
    setPermissoes((p) => ({ ...p, [flag]: !p[flag] }));
  }
  function marcarGrupo(flags: string[], valor: boolean) {
    setPermissoes((p) => { const n = { ...p }; flags.forEach((f) => (n[f] = valor)); return n; });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const payload = {
        nome, ativo, permissoes,
        horariosAcesso: horarios,
        filtrosForcados: { departamentos: depIds, tags: tagIds },
      };
      if (usuario) {
        await api.put(`/usuarios/${usuario.id}`, payload);
      } else {
        if (senha.length < 8) { setSalvando(false); return toast('erro', 'Senha minima de 8 caracteres.'); }
        await api.post('/usuarios', { ...payload, email, senha });
      }
      toast('ok', 'Usuario salvo.');
      onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  const tabs: TabKey[] = ['Dados', 'Permissoes', 'Horarios', 'Filtros'];

  return (
    <Modal aberto titulo={usuario ? `Editar ${usuario.nome}` : 'Novo usuario'} onFechar={onFechar} largura="max-w-3xl">
      <div className="flex gap-1 border-b border-slate-200 text-sm">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 ${tab === t ? 'border-b-2 border-marca-600 font-medium text-marca-700' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>

      <div className="mt-4 max-h-[60vh] overflow-y-auto">
        {tab === 'Dados' && (
          <div className="space-y-3">
            <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><label className="label">E-mail</label><input className="input" value={email} disabled={!!usuario} onChange={(e) => setEmail(e.target.value)} /></div>
            {!usuario && <div><label className="label">Senha (min 8)</label><input type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>}
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Usuario ativo</label>
          </div>
        )}

        {tab === 'Permissoes' && (
          <div className="space-y-4">
            {!podePermissoes && <p className="text-sm text-amber-600">Voce nao tem permissao para alterar permissoes.</p>}
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.grupo}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{g.grupo}</span>
                  {podePermissoes && (
                    <span className="flex gap-2 text-xs">
                      <button className="text-marca-600 hover:underline" onClick={() => marcarGrupo(g.flags.map((f) => f.flag), true)}>todos</button>
                      <button className="text-slate-400 hover:underline" onClick={() => marcarGrupo(g.flags.map((f) => f.flag), false)}>nenhum</button>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {g.flags.map((f) => (
                    <label key={f.flag} className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" disabled={!podePermissoes} checked={!!permissoes[f.flag]} onChange={() => togglePerm(f.flag)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Horarios' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Janelas de acesso permitidas. Sem janelas = acesso livre.</p>
            {horarios.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <select className="input w-28" value={h.diaSemana} onChange={(e) => setHorarios((arr) => arr.map((x, j) => j === i ? { ...x, diaSemana: Number(e.target.value) } : x))}>
                  {DIAS_SEMANA_LABEL.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                </select>
                <input type="time" className="input w-32" value={h.inicio} onChange={(e) => setHorarios((arr) => arr.map((x, j) => j === i ? { ...x, inicio: e.target.value } : x))} />
                <span className="text-slate-400">ate</span>
                <input type="time" className="input w-32" value={h.fim} onChange={(e) => setHorarios((arr) => arr.map((x, j) => j === i ? { ...x, fim: e.target.value } : x))} />
                <button className="btn-ghost" onClick={() => setHorarios((arr) => arr.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="btn-ghost border border-slate-300" onClick={() => setHorarios((arr) => [...arr, { diaSemana: 1, inicio: '08:00', fim: '18:00' }])}>+ Adicionar janela</button>
          </div>
        )}

        {tab === 'Filtros' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Restringe a visao do usuario a determinados departamentos e/ou tags (aplicado em todas as listagens). Vazio = sem restricao.</p>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Departamentos</div>
              <div className="flex flex-wrap gap-2">
                {departamentos.map((d) => (
                  <label key={d.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={depIds.includes(d.id)} onChange={(e) => setDepIds((ids) => e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id))} />{d.nome}</label>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Tags</div>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <label key={t.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={tagIds.includes(t.id)} onChange={(e) => setTagIds((ids) => e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id))} />{t.nome}</label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}

function ReplicarModal({ usuarios, onFechar, onFeito }: { usuarios: UsuarioCompleto[]; onFechar: () => void; onFeito: () => void }) {
  const toast = useToast();
  const [origemId, setOrigemId] = useState('');
  const [destinos, setDestinos] = useState<Set<string>>(new Set());
  const [permissoes, setPermissoes] = useState(true);
  const [horarios, setHorarios] = useState(false);
  const [filtros, setFiltros] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function executar() {
    if (!origemId || destinos.size === 0) return toast('erro', 'Escolha origem e destinos.');
    setSalvando(true);
    try {
      const r = await api.post<{ afetados: number }>('/usuarios/replicar', {
        origemId, destinos: [...destinos], permissoes, horarios, filtros,
      });
      toast('ok', `Replicado para ${r.afetados} usuario(s).`);
      onFeito();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Replicar permissoes / horarios" onFechar={onFechar}>
      <div className="space-y-3">
        <div>
          <label className="label">Copiar de (origem)</label>
          <select className="input" value={origemId} onChange={(e) => setOrigemId(e.target.value)}>
            <option value="">Selecione</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Aplicar em (destinos)</label>
          <div className="max-h-40 overflow-y-auto rounded border border-slate-200 p-2">
            {usuarios.filter((u) => u.id !== origemId).map((u) => (
              <label key={u.id} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={destinos.has(u.id)} onChange={() => setDestinos((s) => { const n = new Set(s); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })} />
                {u.nome}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-4 text-sm text-slate-600">
          <label className="flex items-center gap-2"><input type="checkbox" checked={permissoes} onChange={(e) => setPermissoes(e.target.checked)} /> Permissoes</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={horarios} onChange={(e) => setHorarios(e.target.checked)} /> Horarios</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={filtros} onChange={(e) => setFiltros(e.target.checked)} /> Filtros forcados</label>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={executar} disabled={salvando}>Replicar</button>
        </div>
      </div>
    </Modal>
  );
}
