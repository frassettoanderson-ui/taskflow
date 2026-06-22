import { useEffect, useState } from 'react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { Spinner, useToast } from '../../components/ui';
import type { RoboJob, EmpresaLista, Obrigacao } from '../../lib/tipos';

export default function Revisao() {
  const toast = useToast();
  const [jobs, setJobs] = useState<RoboJob[] | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaLista[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);

  function carregar() {
    api.get<RoboJob[]>('/robo/jobs?status=REVISAO').then(setJobs).catch(() => setJobs([]));
  }
  useEffect(() => {
    carregar();
    api.get<{ items: EmpresaLista[] }>('/empresas?limit=100').then((p) => setEmpresas(p.items)).catch(() => undefined);
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
  }, []);

  async function previa(jobId: string) {
    const res = await fetch(`/api/v1/robo/jobs/${jobId}/arquivo`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!res.ok) return toast('erro', 'Arquivo indisponivel.');
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  if (!jobs) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Revisao do Robo</h1>
      <p className="text-sm text-slate-500">Documentos que o robo nao conseguiu casar automaticamente. Complete os dados para dar baixa.</p>

      {jobs.length === 0 && <div className="card p-10 text-center text-slate-400">Nada pendente de revisao. 🎉</div>}

      <div className="space-y-3">
        {jobs.map((j) => (
          <ItemRevisao
            key={j.id}
            job={j}
            empresas={empresas}
            obrigacoes={obrigacoes}
            onPrevia={() => previa(j.id)}
            onResolvido={() => { toast('ok', 'Baixa realizada.'); carregar(); }}
            onReprocessado={(r) => {
              if (r.baixados > 0) toast('ok', 'Reprocessado: baixa automatica realizada!');
              else if (r.revisao > 0) toast('ok', 'Reprocessado, mas ainda em revisao (ajuste a assinatura ou a entrega).');
              else toast('ok', 'Reprocessado.');
              carregar();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ItemRevisao({ job, empresas, obrigacoes, onPrevia, onResolvido, onReprocessado }: {
  job: RoboJob; empresas: EmpresaLista[]; obrigacoes: Obrigacao[]; onPrevia: () => void; onResolvido: () => void;
  onReprocessado: (r: { total: number; baixados: number; revisao: number }) => void;
}) {
  const toast = useToast();
  const hoje = new Date();
  const [empresaId, setEmpresaId] = useState(job.empresaId ?? '');
  const [obrigacaoNome, setObrigacaoNome] = useState(job.obrigacaoNome ?? '');
  const [ano, setAno] = useState(job.competenciaAno ?? hoje.getFullYear());
  const [mes, setMes] = useState(job.competenciaMes ?? hoje.getMonth() + 1);
  const [salvando, setSalvando] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);

  async function resolver() {
    if (!empresaId || !obrigacaoNome) return toast('erro', 'Selecione empresa e obrigacao.');
    setSalvando(true);
    try {
      await api.post(`/robo/revisao/${job.id}/resolver`, { empresaId, obrigacaoNome, competenciaAno: Number(ano), competenciaMes: Number(mes) });
      onResolvido();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  async function reprocessar() {
    setReprocessando(true);
    try {
      const r = await api.post<{ total: number; baixados: number; revisao: number }>(`/robo/revisao/${job.id}/reprocessar`, {});
      onReprocessado(r);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setReprocessando(false); }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-700">{job.arquivoNome}</div>
          <div className="text-xs text-amber-700">{job.motivo}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost border border-slate-300" onClick={reprocessar} disabled={reprocessando} title="Re-roda a identificacao automatica (util apos cadastrar/ajustar assinaturas)">{reprocessando ? 'Reprocessando...' : 'Reprocessar'}</button>
          <button className="btn-ghost border border-slate-300" onClick={onPrevia}>Ver PDF</button>
        </div>
      </div>
      {job.textoTrecho && <pre className="mt-2 max-h-24 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-500">{job.textoTrecho}</pre>}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Empresa</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
        </select>
        <select className="input" value={obrigacaoNome} onChange={(e) => setObrigacaoNome(e.target.value)}>
          <option value="">Obrigacao</option>
          {obrigacoes.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
        </select>
        <input type="number" className="input" placeholder="Mes" value={mes} min={1} max={12} onChange={(e) => setMes(Number(e.target.value))} />
        <input type="number" className="input" placeholder="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
      </div>
      <div className="mt-2 flex justify-end">
        <button className="btn-primary" onClick={resolver} disabled={salvando}>{salvando ? 'Baixando...' : 'Dar baixa'}</button>
      </div>
    </div>
  );
}
