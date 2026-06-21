import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, SlidersHorizontal, Printer, CalendarDays, Plus, User as UserIcon } from 'lucide-react';
import { api, ApiError, getAccessToken } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Modal, Spinner, useToast } from '../components/ui';
import { TIPOS_USUARIO } from '../lib/tipos';
import type { UsuarioCompleto } from '../lib/tipos';

interface ChipF { kind: 'status' | 'tipo'; valor: string; label: string }

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

  // toolbar (toggles independentes: ao abrir um, o outro permanece)
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mostrarImprimir, setMostrarImprimir] = useState(false);
  const [mostrarDatas, setMostrarDatas] = useState(false);
  const [comboTxt, setComboTxt] = useState('');
  const [comboAberto, setComboAberto] = useState(false);
  const [chips, setChips] = useState<ChipF[]>([]);
  const [datas, setDatas] = useState({ criadoDe: '', criadoAte: '', acessoDe: '', acessoAte: '' });

  function carregar() {
    setLoading(true);
    api.get<UsuarioCompleto[]>('/usuarios?incluirInativos=true').then(setUsuarios).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function exportar() {
    const res = await fetch('/api/v1/usuarios/export', { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'usuarios.csv'; a.click(); URL.revokeObjectURL(url);
  }

  function addChip(c: ChipF) {
    setChips((cur) => (cur.some((x) => x.kind === c.kind && x.valor === c.valor) ? cur : [...cur, c]));
    setComboTxt(''); setComboAberto(false);
  }
  function removeChip(c: ChipF) { setChips((cur) => cur.filter((x) => !(x.kind === c.kind && x.valor === c.valor))); }

  if (loading) return <Spinner />;

  // opcoes do combo +Filtros (filtradas pelo texto)
  const tq = comboTxt.trim().toLowerCase();
  const optsStatus = [
    { valor: 'ocultar_ativos', label: 'Ocultar Ativos' },
    { valor: 'exibir_inativos', label: 'Exibir Inativos' },
  ].filter((o) => o.label.toLowerCase().includes(tq));
  const optsTipo = TIPOS_USUARIO.filter((t) => t.toLowerCase().includes(tq));

  // aplica filtros
  const termo = filtro.trim().toLowerCase();
  const tiposSel = chips.filter((c) => c.kind === 'tipo').map((c) => c.valor);
  const ocultarAtivos = chips.some((c) => c.valor === 'ocultar_ativos');
  const exibirInativos = chips.some((c) => c.valor === 'exibir_inativos');
  const lista = usuarios.filter((u) => {
    if (termo && !u.nome.toLowerCase().includes(termo) && !u.email.toLowerCase().includes(termo)) return false;
    if (ocultarAtivos ? u.ativo : !exibirInativos && !u.ativo) return false;
    if (tiposSel.length && !tiposSel.includes(u.tipo ?? '')) return false;
    return true;
  });

  const ICO = 'grid h-9 w-9 place-items-center rounded text-purple-500 hover:bg-purple-50';

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-4 text-[13px]">
      {/* cabecalho (breadcrumb) */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <Users size={16} className="text-slate-400" />
          <span className="text-slate-400">Sistema</span>
          <span className="text-slate-300">&rsaquo;</span>
          <span className="font-medium text-slate-700">Relacao de usuarios e suas permissoes</span>
          <span className="text-slate-400">[Ctrl+U]</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* barra de filtros */}
      <div className="rounded border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input className="flex-1 min-w-[220px] rounded border border-slate-300 px-3 py-1.5 text-[13px] outline-none focus:border-marca-400"
            placeholder="Filtrar pelo nome ou por e-mail" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <button onClick={() => setMostrarFiltros((v) => !v)}
            className="flex items-center gap-2 rounded bg-purple-400 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-purple-500">
            <SlidersHorizontal size={14} /> +Filtros
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button title="Imprimir" className={ICO} onClick={() => setMostrarImprimir((v) => !v)}><Printer size={17} /></button>
            <button title="Exibir/ocultar datas" className={ICO} onClick={() => setMostrarDatas((v) => !v)}><CalendarDays size={17} /></button>
            <button onClick={carregar} className="ml-1 flex items-center gap-2 rounded bg-status-ok px-4 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-600"><Search size={14} /> Filtrar</button>
            {podeUsuarios && <button onClick={() => navigate('/usuarios/novo')} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-marca-600"><Plus size={14} /> Novo usuario</button>}
          </div>
        </div>

        {/* +Filtros: combo com chips (sem Sanfona p/ nao cortar o dropdown absoluto) */}
        {mostrarFiltros && (
          <div className="relative mt-2 border-t border-slate-100 pt-2">
            <div className="flex flex-wrap items-center gap-1.5 rounded border border-slate-300 px-2 py-1.5">
              {chips.map((c) => (
                <span key={`${c.kind}-${c.valor}`} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600">
                  <button onClick={() => removeChip(c)} className="text-slate-400 hover:text-red-500">×</button>{c.label}
                </span>
              ))}
              <input className="min-w-[120px] flex-1 text-[13px] outline-none" placeholder="Filtros..." value={comboTxt}
                onChange={(e) => { setComboTxt(e.target.value); setComboAberto(true); }}
                onFocus={() => setComboAberto(true)} onBlur={() => setTimeout(() => setComboAberto(false), 150)} />
            </div>
            {comboAberto && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
                {optsStatus.length > 0 && <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">Filtrar por Status</div>}
                {optsStatus.map((o) => (
                  <button key={o.valor} onMouseDown={() => addChip({ kind: 'status', valor: o.valor, label: o.label })} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-marca-50">{o.label}</button>
                ))}
                {optsTipo.length > 0 && <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">Filtrar por Tipo</div>}
                {optsTipo.map((t) => (
                  <button key={t} onMouseDown={() => addChip({ kind: 'tipo', valor: t, label: t })} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-marca-50">{t}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Imprimir: PDF / Excel */}
        <Sanfona aberto={mostrarImprimir}>
          <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2 md:w-1/2">
            <button onClick={() => toast('ok', 'Em construcao: PDF')} className="flex items-center justify-center gap-2 rounded bg-sky-500 py-2 text-[13px] font-medium text-white hover:bg-sky-600"><Printer size={15} /> PDF</button>
            <button onClick={exportar} className="flex items-center justify-center gap-2 rounded bg-purple-500 py-2 text-[13px] font-medium text-white hover:bg-purple-600"><Printer size={15} /> Excel</button>
          </div>
        </Sanfona>

        {/* Datas */}
        <Sanfona aberto={mostrarDatas}>
          <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2 md:grid-cols-4">
            <DataF label="Criado de" value={datas.criadoDe} onChange={(v) => setDatas((s) => ({ ...s, criadoDe: v }))} />
            <DataF label="Criado ate" value={datas.criadoAte} onChange={(v) => setDatas((s) => ({ ...s, criadoAte: v }))} />
            <DataF label="Ultimo acesso de" value={datas.acessoDe} onChange={(v) => setDatas((s) => ({ ...s, acessoDe: v }))} />
            <DataF label="Ultimo acesso ate" value={datas.acessoAte} onChange={(v) => setDatas((s) => ({ ...s, acessoAte: v }))} />
          </div>
        </Sanfona>
      </div>

      {/* acoes secundarias (recursos nossos) */}
      {(podePermissoes || podeTransferir) && (
        <div className="mt-1 flex justify-end gap-3 text-[12px]">
          {podePermissoes && <button className="text-marca-600 hover:underline" onClick={() => setReplicar(true)}>Replicar permissoes</button>}
          {podeTransferir && <button className="text-marca-600 hover:underline" onClick={() => setTransferir(true)}>Transferir responsabilidade</button>}
        </div>
      )}

      {/* tabela */}
      <div className="mt-2 overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-marca-600">
              <th className="px-3 py-2">Nome [Tipo]</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Ultimo acesso [IP]</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}
                className={`border-b border-slate-100 ${podeUsuarios ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={() => podeUsuarios && navigate(`/usuarios/${u.id}`)}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <UserIcon className={u.ativo ? 'text-status-ok' : 'text-status-danger'} size={15} />
                    <span className="font-medium text-sky-500">{u.nome}</span>
                    {u.tipo && <span className="text-slate-700">[{u.tipo}]</span>}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">{u.email}</td>
                <td className="px-3 py-2 text-slate-400">&mdash;</td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={3} className="px-3 py-10 text-center text-slate-400">Nenhum usuario.</td></tr>}
          </tbody>
        </table>
      </div>

      {replicar && <ReplicarModal usuarios={usuarios} onFechar={() => setReplicar(false)} onFeito={() => { setReplicar(false); carregar(); }} />}
      {transferir && <TransferirModal usuarios={usuarios} onFechar={() => setTransferir(false)} />}
    </div>
  );
}

// container colapsavel com leve animacao (slide)
function Sanfona({ aberto, children }: { aberto: boolean; children: React.ReactNode }) {
  return (
    <div className="grid transition-all duration-200 ease-out" style={{ gridTemplateRows: aberto ? '1fr' : '0fr' }}>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function DataF({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] uppercase text-slate-400">{label}</div>
      <input type="date" className="w-full rounded border border-slate-300 px-2 py-1.5 text-center text-[12px] text-slate-600 outline-none focus:border-marca-400" value={value} onChange={(e) => onChange(e.target.value)} />
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
