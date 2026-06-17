import { useEffect, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Badge, Spinner, useToast } from '../components/ui';

interface JobInfo { nome: string; descricao: string }
interface Execucao { id: string; job: string; status: string; itens: number; duracaoMs: number; detalhe: string | null; createdAt: string }

const NOME_LEGIVEL: Record<string, string> = {
  geracao_mensal: 'Geracao mensal de entregas',
  recorrencia_processos: 'Recorrencia de processos',
  alertas_prazos: 'Alertas de prazos',
  lembrete_protocolos: 'Lembrete de protocolos',
};

export default function Jobs() {
  const toast = useToast();
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [rodando, setRodando] = useState<string | null>(null);

  function carregar() {
    setLoading(true);
    api.get<{ jobs: JobInfo[]; execucoes: Execucao[] }>('/notificacoes/jobs/lista')
      .then((d) => { setJobs(d.jobs); setExecucoes(d.execucoes); })
      .finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function executar(nome: string) {
    setRodando(nome);
    try {
      const r = await api.post<{ status: string; itens: number; detalhe: string }>('/notificacoes/jobs/executar', { nome });
      toast(r.status === 'OK' ? 'ok' : 'erro', `${NOME_LEGIVEL[nome] ?? nome}: ${r.detalhe}`);
      carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao executar.'); }
    finally { setRodando(null); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Tarefas e Alertas (agendador)</h1>
          <p className="text-sm text-slate-500">Rotinas automaticas que rodam a cada hora. Voce tambem pode executar manualmente.</p>
        </div>
        <button className="btn-ghost border border-slate-300" onClick={carregar}><RefreshCw size={16} /> Atualizar</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {jobs.map((j) => (
          <div key={j.nome} className="card flex items-start justify-between gap-3 p-4">
            <div>
              <div className="font-medium text-slate-700">{NOME_LEGIVEL[j.nome] ?? j.nome}</div>
              <div className="text-sm text-slate-500">{j.descricao}</div>
            </div>
            <button className="btn-primary shrink-0" disabled={rodando === j.nome} onClick={() => executar(j.nome)}>
              <Play size={15} /> {rodando === j.nome ? 'Rodando...' : 'Executar'}
            </button>
          </div>
        ))}
      </div>

      <h2 className="pt-2 text-lg font-semibold text-slate-700">Ultimas execucoes</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Job</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Itens</th><th className="px-3 py-2">Duracao</th><th className="px-3 py-2">Detalhe</th><th className="px-3 py-2">Quando</th></tr>
          </thead>
          <tbody>
            {execucoes.map((e) => (
              <tr key={e.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{NOME_LEGIVEL[e.job] ?? e.job}</td>
                <td className="px-3 py-2"><Badge className={e.status === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{e.status}</Badge></td>
                <td className="px-3 py-2 text-slate-500">{e.itens}</td>
                <td className="px-3 py-2 text-slate-500">{e.duracaoMs} ms</td>
                <td className="px-3 py-2 text-slate-500">{e.detalhe}</td>
                <td className="px-3 py-2 text-slate-400">{new Date(e.createdAt).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {execucoes.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Nenhuma execucao ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
