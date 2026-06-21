import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SquarePen, SlidersHorizontal, X, Printer, CalendarDays, Search, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner } from '../../components/ui';
import type { ProtocoloFisico, StatusProtocoloFisico } from '../../lib/tipos';
import { STATUS_FISICO_LABEL } from '../../lib/tipos';

const COR: Record<StatusProtocoloFisico, string> = {
  PENDENTE: '#e08a1e', AGUARDANDO_RETIRADA: '#e08a1e',
  IMPRESSO: '#69a8d9', DEVOLVIDO: '#69a8d9',
  ENTREGUE: '#88b87f', CANCELADO: '#d15b47',
};

// flag -> status (inclui legados)
const GRUPO: Record<string, StatusProtocoloFisico[]> = {
  pendentes: ['PENDENTE', 'AGUARDANDO_RETIRADA'],
  impresso: ['IMPRESSO', 'DEVOLVIDO'],
  entregues: ['ENTREGUE'],
  cancelados: ['CANCELADO'],
};

function dataCurta(d?: string | null): string {
  if (!d) return '-';
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`;
}

const INP = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-marca-400 focus:ring-1 focus:ring-marca-100';

export default function ProtocolosFisicos() {
  const navigate = useNavigate();
  const { sessao } = useAuth();
  const podeGerenciar = temPermissao(sessao, 'documentos_upload');

  const [q, setQ] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [flags, setFlags] = useState({ pendentes: true, impresso: false, entregues: false, cancelados: false });
  const [itens, setItens] = useState<ProtocoloFisico[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  function carregar() {
    setLoading(true);
    const statusList = Object.entries(flags).filter(([, v]) => v).flatMap(([k]) => GRUPO[k]);
    const qs = new URLSearchParams();
    if (q.trim()) qs.set('q', q.trim());
    if (statusList.length) qs.set('statusList', statusList.join(','));
    api.get<ProtocoloFisico[]>(`/protocolos-fisicos?${qs}`).then(setItens).catch(() => setItens([])).finally(() => setLoading(false));
  }
  useEffect(carregar, [tick]);

  const Flag = ({ k, label, cor }: { k: keyof typeof flags; label: string; cor: string }) => (
    <label className="flex cursor-pointer select-none items-center gap-1.5 rounded px-1.5 py-1" style={{ background: cor }}>
      <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))} className="accent-marca-600" />
      <span className="text-[12px] font-medium text-slate-700">{label}</span>
    </label>
  );

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* cabecalho */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <SquarePen size={16} className="text-slate-400" />
          <span className="text-marca-600 hover:underline cursor-pointer" onClick={() => navigate('/entregas')}>Lista de Entregas</span>
          <span className="text-slate-400">&rsaquo;</span>
          <span className="font-medium text-slate-700">Gestao de protocolos fisicos</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* barra */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white p-2 shadow-sm">
        <input className={`${INP} w-56`} placeholder="Filtrar por Empresa" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setTick((t) => t + 1)} />
        <button onClick={() => setMostrarFiltros((v) => !v)}
          className={`flex items-center gap-2 rounded px-3 py-1.5 text-[12px] font-medium text-white ${mostrarFiltros ? 'bg-status-danger hover:bg-red-600' : 'bg-marca-400 hover:bg-marca-500'}`}>
          {mostrarFiltros ? <X size={14} /> : <SlidersHorizontal size={14} />} {mostrarFiltros ? 'Filtros' : '+Filtros'}
        </button>
        <div className="flex items-center gap-1">
          <Flag k="pendentes" label="Pendentes" cor="#fff3cd" />
          <Flag k="impresso" label="Impresso" cor="#ffffff" />
          <Flag k="entregues" label="Entregues" cor="#e7f1ff" />
          <Flag k="cancelados" label="Cancelados" cor="#fde8ec" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button title="Imprimir" className="grid h-8 w-8 place-items-center rounded text-marca-600 hover:bg-marca-50"><Printer size={17} /></button>
          <button title="Datas" className="grid h-8 w-8 place-items-center rounded text-marca-600 hover:bg-marca-50"><CalendarDays size={17} /></button>
          <span className="px-1 text-[12px] text-marca-600">&laquo; {itens.length} reg &raquo;</span>
          <button onClick={() => setTick((t) => t + 1)} className="flex items-center gap-2 rounded bg-status-ok px-4 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-600">
            <Search size={14} /> Filtrar
          </button>
          {podeGerenciar && (
            <button onClick={() => navigate('/documentos/protocolos-fisicos/novo')} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-marca-600">
              <Plus size={14} /> Novo
            </button>
          )}
        </div>
      </div>

      {/* tabela */}
      <div className="mt-2 overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
              <th className="px-3 py-2">Empresa</th>
              <th className="px-3 py-2">[ID] Titulo</th>
              <th className="px-3 py-2">Dt.Protocolo</th>
              <th className="px-3 py-2">Dt.Entrega</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-12"><Spinner /></td></tr>
            ) : itens.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-12 text-center text-slate-400">Nenhum protocolo fisico.</td></tr>
            ) : itens.map((p) => (
              <tr key={p.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => navigate(`/documentos/protocolos-fisicos/${p.id}`)}>
                <td className="px-3 py-2 text-slate-700">{p.empresa?.razaoSocial ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600"><span className="text-slate-400">[{p.numero ?? '-'}]</span> {p.titulo ?? p.descricao}</td>
                <td className="px-3 py-2 text-slate-500">{dataCurta(p.data)}</td>
                <td className="px-3 py-2 text-slate-500">{dataCurta(p.dataEntrega)}</td>
                <td className="px-3 py-2">
                  <span className="inline-block rounded px-2 py-0.5 text-[12px] font-medium" style={{ background: COR[p.status] + '22', color: COR[p.status] }}>
                    {STATUS_FISICO_LABEL[p.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
