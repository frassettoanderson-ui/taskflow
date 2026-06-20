import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon } from 'lucide-react';
import { api, ApiError, getAccessToken } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../components/ui';
import type { UsuarioCompleto } from '../lib/tipos';

export default function Usuarios() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeUsuarios = temPermissao(sessao, 'admin_usuarios');
  const podePermissoes = temPermissao(sessao, 'admin_permissoes');
  const podeTransferir = temPermissao(sessao, 'admin_transferir_resp');

  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [replicar, setReplicar] = useState(false);
  const [transferir, setTransferir] = useState(false);

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

  const termo = filtro.trim().toLowerCase();
  const lista = termo ? usuarios.filter((u) => u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo)) : usuarios;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Relacao de usuarios e suas permissoes</h1>
        <div className="flex gap-2">
          <button className="btn-ghost border border-slate-300" onClick={exportar}>Exportar</button>
          {podePermissoes && <button className="btn-ghost border border-slate-300" onClick={() => setReplicar(true)}>Replicar permissoes</button>}
          {podeTransferir && <button className="btn-ghost border border-slate-300" onClick={() => setTransferir(true)}>Transferir responsabilidade</button>}
          {podeUsuarios && <button className="btn-primary" onClick={() => navigate('/usuarios/novo')}>+ Novo usuario</button>}
        </div>
      </div>

      <input className="input max-w-xl" placeholder="Filtrar pelo nome ou por e-mail" value={filtro} onChange={(e) => setFiltro(e.target.value)} />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Nome [Tipo]</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Permissoes</th><th className="px-3 py-2">Horarios</th><th className="px-3 py-2">Status</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const ativas = Object.values(u.permissoes).filter(Boolean).length;
              return (
                <tr
                  key={u.id}
                  className={`border-b border-slate-100 ${podeUsuarios ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  onClick={() => podeUsuarios && navigate(`/usuarios/${u.id}`)}
                >
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <UserIcon className={u.ativo ? 'text-status-ok' : 'text-status-danger'} size={15} />
                      <span className="font-medium text-marca-700">{u.nome}</span>
                      {u.tipo && <span className="text-slate-400">[{u.tipo}]</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{u.email}</td>
                  <td className="px-3 py-2 text-slate-500">{ativas} ativas</td>
                  <td className="px-3 py-2 text-slate-500">{u.horariosAcesso.length ? `${u.horariosAcesso.length} janela(s)` : 'livre'}</td>
                  <td className="px-3 py-2">{u.ativo ? <Badge className="bg-emerald-100 text-emerald-700">Ativo</Badge> : <Badge className="bg-slate-200 text-slate-600">Inativo</Badge>}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2 text-xs">
                      {podeUsuarios && <button className="text-slate-500 hover:underline" onClick={() => resetSenha(u)}>senha</button>}
                      {podeUsuarios && u.ativo && <button className="text-red-500 hover:underline" onClick={() => inativar(u)}>inativar</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Nenhum usuario.</td></tr>}
          </tbody>
        </table>
      </div>

      {replicar && <ReplicarModal usuarios={usuarios} onFechar={() => setReplicar(false)} onFeito={() => { setReplicar(false); carregar(); }} />}
      {transferir && <TransferirModal usuarios={usuarios} onFechar={() => setTransferir(false)} />}
    </div>
  );
}

function TransferirModal({ usuarios, onFechar }: { usuarios: UsuarioCompleto[]; onFechar: () => void }) {
  const toast = useToast();
  const [deId, setDeId] = useState('');
  const [paraId, setParaId] = useState('');
  const [opts, setOpts] = useState({ departamentosEmpresa: true, entregasPendentes: true, processos: true, departamentosGestor: false });
  const [salvando, setSalvando] = useState(false);

  async function executar() {
    if (!deId || !paraId) return toast('erro', 'Escolha o usuario de origem e o de destino.');
    if (deId === paraId) return toast('erro', 'Origem e destino devem ser diferentes.');
    if (!window.confirm('Confirmar a transferencia de responsabilidade entre os usuarios selecionados?')) return;
    setSalvando(true);
    try {
      const r = await api.post<{ responsaveisDepartamento: number; entregas: number; processos: number; departamentos: number }>(
        '/usuarios/transferir-responsabilidade', { deUsuarioId: deId, paraUsuarioId: paraId, ...opts },
      );
      toast('ok', `Transferido: ${r.responsaveisDepartamento} resp. de dpto, ${r.entregas} demandas, ${r.processos} processos, ${r.departamentos} dptos.`);
      onFechar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  const Op = ({ k, label }: { k: keyof typeof opts; label: string }) => (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} /> {label}
    </label>
  );

  return (
    <Modal aberto titulo="Transferir responsabilidade" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-[13px] text-slate-500">Reatribui as responsabilidades de um colaborador (que saiu de ferias, foi desligado, etc.) para outro.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">De (origem)</label>
            <select className="input" value={deId} onChange={(e) => setDeId(e.target.value)}>
              <option value="">Selecione</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Para (destino)</label>
            <select className="input" value={paraId} onChange={(e) => setParaId(e.target.value)}>
              <option value="">Selecione</option>
              {usuarios.filter((u) => u.id !== deId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5 rounded border border-slate-200 p-3">
          <Op k="departamentosEmpresa" label="Responsavel por departamentos das empresas" />
          <Op k="entregasPendentes" label="Demandas pendentes na Lista de Entregas" />
          <Op k="processos" label="Processos em andamento / suspensos" />
          <Op k="departamentosGestor" label="Gestor/responsavel dos departamentos (cadastro)" />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={executar} disabled={salvando}>{salvando ? 'Transferindo...' : 'Transferir'}</button>
        </div>
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
