import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type { ProcessoLista, Matriz, EmpresaLista, StatusProcesso } from '../../lib/tipos';
import { STATUS_PROCESSO_INFO, dataBR } from '../../lib/tipos';

const COLUNAS: StatusProcesso[] = ['EM_ANDAMENTO', 'SUSPENSO', 'CONCLUIDO', 'CANCELADO'];

export default function Processos() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeOperar = temPermissao(sessao, 'processos_operar');

  const [processos, setProcessos] = useState<ProcessoLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban');
  const [iniciar, setIniciar] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<ProcessoLista[]>('/processos').then(setProcessos).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function exportar() {
    const res = await fetch('/api/v1/processos/export', { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    const blob = await res.blob(); const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = 'processos.csv'; a.click(); URL.revokeObjectURL(u);
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Gestao de Processos</h1>
        <div className="flex gap-2">
          <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1 text-sm">
            {(['kanban', 'lista'] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)} className={`rounded px-3 py-1 ${vista === v ? 'bg-marca-500 text-white' : 'text-slate-600'}`}>{v === 'kanban' ? 'Kanban' : 'Lista'}</button>
            ))}
          </div>
          <button className="btn-ghost border border-slate-300" onClick={exportar}>Exportar</button>
          {podeOperar && <button className="btn-primary" onClick={() => setIniciar(true)}>+ Iniciar processo</button>}
        </div>
      </div>

      {vista === 'kanban' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((col) => {
            const itens = processos.filter((p) => p.status === col);
            return (
              <div key={col} className="rounded-lg bg-slate-100 p-2">
                <div className="mb-2 flex items-center justify-between px-2 py-1 text-sm font-medium" style={{ color: STATUS_PROCESSO_INFO[col].cor }}>
                  {STATUS_PROCESSO_INFO[col].label}<span className="rounded-full bg-white px-2 text-xs">{itens.length}</span>
                </div>
                <div className="space-y-2">
                  {itens.map((p) => (
                    <button key={p.id} onClick={() => navigate(`/processos/${p.id}`)} className="card w-full p-3 text-left hover:shadow-md">
                      <div className="text-sm font-medium text-slate-700">{p.nome}</div>
                      <div className="text-xs text-slate-500">{p.empresa?.razaoSocial}</div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-marca-500" style={{ width: `${p.progresso}%` }} />
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">{p.passosConcluidos}/{p.totalPassos} passos</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Processo</th><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Progresso</th><th className="px-3 py-2">Inicio</th><th className="px-3 py-2">Status</th></tr>
            </thead>
            <tbody>
              {processos.map((p) => (
                <tr key={p.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => navigate(`/processos/${p.id}`)}>
                  <td className="px-3 py-2 font-medium text-slate-700">{p.nome}</td>
                  <td className="px-3 py-2 text-slate-500">{p.empresa?.razaoSocial}</td>
                  <td className="px-3 py-2 text-slate-500">{p.progresso}%</td>
                  <td className="px-3 py-2 text-slate-500">{dataBR(p.dataInicio)}</td>
                  <td className="px-3 py-2"><Badge cor={STATUS_PROCESSO_INFO[p.status].cor}>{STATUS_PROCESSO_INFO[p.status].label}</Badge></td>
                </tr>
              ))}
              {processos.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Nenhum processo.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {iniciar && <ModalIniciar onFechar={() => setIniciar(false)} onIniciado={(id) => navigate(`/processos/${id}`)} />}
    </div>
  );
}

function ModalIniciar({ onFechar, onIniciado }: { onFechar: () => void; onIniciado: (id: string) => void }) {
  const toast = useToast();
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLista[]>([]);
  const [matrizId, setMatrizId] = useState('');
  const [empresaId, setEmpresaId] = useState('');

  useEffect(() => {
    api.get<Matriz[]>('/matrizes').then(setMatrizes).catch(() => undefined);
    api.get<{ items: EmpresaLista[] }>('/empresas?limit=100').then((p) => setEmpresas(p.items)).catch(() => undefined);
  }, []);

  async function iniciar() {
    if (!matrizId || !empresaId) return toast('erro', 'Escolha matriz e empresa.');
    try {
      const p = await api.post<{ id: string }>('/processos/iniciar', { matrizId, empresaId });
      toast('ok', 'Processo iniciado.');
      onIniciado(p.id);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <Modal aberto titulo="Iniciar processo" onFechar={onFechar}>
      <div className="space-y-3">
        <div>
          <label className="label">Matriz</label>
          <select className="input" value={matrizId} onChange={(e) => setMatrizId(e.target.value)}>
            <option value="">Selecione</option>
            {matrizes.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.passos.length} passos)</option>)}
          </select>
        </div>
        <div>
          <label className="label">Empresa</label>
          <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">Selecione</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={iniciar}>Iniciar</button>
        </div>
      </div>
    </Modal>
  );
}
