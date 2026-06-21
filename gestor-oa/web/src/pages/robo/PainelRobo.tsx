import { Fragment, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, Spinner } from '../../components/ui';
import type { RoboJob, RoboPainel } from '../../lib/tipos';
import { STATUS_ROBO_INFO } from '../../lib/tipos';

export default function PainelRobo() {
  const [painel, setPainel] = useState<RoboPainel | null>(null);
  const [jobs, setJobs] = useState<RoboJob[]>([]);
  const [status, setStatus] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);

  function carregar() {
    api.get<RoboPainel>('/robo/painel').then(setPainel);
    api.get<RoboJob[]>(`/robo/jobs${status ? `?status=${status}` : ''}`).then(setJobs);
  }
  useEffect(carregar, [status]);

  if (!painel) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Painel do Robo</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card titulo="Hoje" valor={painel.processadosHoje} />
        <Card titulo="No mes" valor={painel.processadosMes} />
        <Card titulo="Baixados (mes)" valor={painel.baixadosMes} cor="#88b87f" />
        <Card titulo="Taxa de match" valor={`${painel.taxaMatch}%`} cor="#3f8cba" />
        <Card titulo="Em revisao" valor={painel.pendentesRevisao} cor="#ffb752" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Filtrar:</span>
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(STATUS_ROBO_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Arquivo</th><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Obrigacao</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Quando</th></tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <Fragment key={j.id}>
                <tr className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setAberto(aberto === j.id ? null : j.id)}>
                  <td className="px-3 py-2 text-slate-700">{j.arquivoNome}</td>
                  <td className="px-3 py-2 text-slate-500">{j.empresaNome ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{j.obrigacaoNome ?? '—'}</td>
                  <td className="px-3 py-2"><Badge cor={STATUS_ROBO_INFO[j.status].cor}>{STATUS_ROBO_INFO[j.status].label}</Badge></td>
                  <td className="px-3 py-2 text-xs text-slate-400">{new Date(j.createdAt).toLocaleString('pt-BR')}</td>
                </tr>
                {aberto === j.id && (
                  <tr><td colSpan={5} className="bg-slate-50 px-4 py-2 text-xs">
                    {j.motivo && <div className="mb-1 text-amber-700">Motivo: {j.motivo}</div>}
                    <div className="flex flex-wrap gap-2">
                      {j.etapas.map((e, i) => (
                        <span key={i} className={`rounded px-2 py-0.5 ${e.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {e.etapa} {e.ms}ms {e.detalhe ? `· ${e.detalhe}` : ''}
                        </span>
                      ))}
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
            {jobs.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Nenhum processamento.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ titulo, valor, cor }: { titulo: string; valor: number | string; cor?: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-bold" style={{ color: cor ?? '#334155' }}>{valor}</div>
      <div className="text-xs text-slate-500">{titulo}</div>
    </div>
  );
}
