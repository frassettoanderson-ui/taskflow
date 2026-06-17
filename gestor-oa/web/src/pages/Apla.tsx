import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Settings2, TrendingUp, TrendingDown, DollarSign, Clock } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Spinner, Modal, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';

interface EmpresaApla { empresa: string; obrigacoes: number; honorario: number; horas: number; custo: number; margem: number; margemPct: number }
interface Apla {
  periodo: string; custoHora: number;
  kpis: { receitaTotal: number; custoTotal: number; lucro: number; margemPct: number; horasTotais: number; ticketMedio: number; empresas: number; deficitarias: number };
  empresas: EmpresaApla[];
  porDepartamento: { nome: string; cor: string; receita: number; custo: number; margem: number }[];
  porColaborador: { nome: string; baixadas: number; pendentes: number; horasProduzidas: number; valorProduzido: number }[];
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Apla() {
  const toast = useToast();
  const { sessao } = useAuth();
  const podeConfig = !!sessao?.usuario.permissoes['apla_configurar'];
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [d, setD] = useState<Apla | null>(null);
  const [loading, setLoading] = useState(true);
  const [cfgAberto, setCfgAberto] = useState(false);
  const [custoHora, setCustoHora] = useState('');

  function carregar() {
    setLoading(true);
    api.get<Apla>(`/apla/relatorio?ano=${ano}&mes=${mes}`).then((r) => { setD(r); setCustoHora(String(r.custoHora)); }).finally(() => setLoading(false));
  }
  useEffect(carregar, [ano, mes]);

  async function salvarConfig() {
    try {
      await api.put('/apla/config', { custoHora: Number(custoHora) || 0 });
      setCfgAberto(false); toast('ok', 'Custo/hora atualizado.'); carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro.'); }
  }

  if (loading || !d) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Metodo APLA</h1>
          <p className="text-sm text-slate-500">Produtividade e lucratividade · {d.periodo} · custo/hora {brl(d.custoHora)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-24" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
          </select>
          <select className="input w-28" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {podeConfig && <button className="btn-ghost border border-slate-300" onClick={() => setCfgAberto(true)}><Settings2 size={16} /> Custo/hora</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi titulo="Receita (honorarios)" valor={brl(d.kpis.receitaTotal)} icone={DollarSign} cor="text-emerald-600" />
        <Kpi titulo="Custo estimado" valor={brl(d.kpis.custoTotal)} icone={Clock} cor="text-amber-600" />
        <Kpi titulo="Lucro" valor={brl(d.kpis.lucro)} icone={d.kpis.lucro >= 0 ? TrendingUp : TrendingDown} cor={d.kpis.lucro >= 0 ? 'text-marca-600' : 'text-red-600'} sub={`Margem ${d.kpis.margemPct}%`} />
        <Kpi titulo="Ticket medio" valor={brl(d.kpis.ticketMedio)} icone={DollarSign} cor="text-sky-600" sub={`${d.kpis.empresas} empresas · ${d.kpis.deficitarias} no prejuizo`} />
      </div>

      <div className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Lucratividade por departamento</h2>
        {d.porDepartamento.length === 0 ? <Sem /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.porDepartamento}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="nome" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: number) => brl(v)} /><Legend />
              <Bar dataKey="receita" name="Receita" fill="#5cb85c" />
              <Bar dataKey="custo" name="Custo" fill="#f0ad4e" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 pt-4 text-sm font-semibold text-slate-700">Lucratividade por empresa (pior margem primeiro)</div>
        <table className="mt-2 w-full text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Obrig.</th><th className="px-3 py-2">Honorario</th><th className="px-3 py-2">Horas</th><th className="px-3 py-2">Custo</th><th className="px-3 py-2">Margem</th><th className="px-3 py-2">Margem %</th></tr>
          </thead>
          <tbody>
            {d.empresas.map((e, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{e.empresa}</td>
                <td className="px-3 py-2 text-slate-500">{e.obrigacoes}</td>
                <td className="px-3 py-2 text-slate-600">{brl(e.honorario)}</td>
                <td className="px-3 py-2 text-slate-500">{e.horas}h</td>
                <td className="px-3 py-2 text-slate-500">{brl(e.custo)}</td>
                <td className={`px-3 py-2 font-medium ${e.margem < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{brl(e.margem)}</td>
                <td className={`px-3 py-2 ${e.margem < 0 ? 'text-red-600' : 'text-slate-500'}`}>{e.margemPct}%</td>
              </tr>
            ))}
            {d.empresas.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Sem honorarios/obrigacoes cadastrados. Informe honorarios na ficha da empresa.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 pt-4 text-sm font-semibold text-slate-700">Produtividade por colaborador (mes)</div>
        <table className="mt-2 w-full text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Colaborador</th><th className="px-3 py-2">Baixadas</th><th className="px-3 py-2">Pendentes</th><th className="px-3 py-2">Horas produzidas</th><th className="px-3 py-2">Valor produzido</th></tr>
          </thead>
          <tbody>
            {d.porColaborador.map((c, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{c.nome}</td>
                <td className="px-3 py-2 text-emerald-600">{c.baixadas}</td>
                <td className="px-3 py-2 text-amber-600">{c.pendentes}</td>
                <td className="px-3 py-2 text-slate-500">{c.horasProduzidas}h</td>
                <td className="px-3 py-2 text-slate-600">{brl(c.valorProduzido)}</td>
              </tr>
            ))}
            {d.porColaborador.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Sem entregas no periodo.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal aberto={cfgAberto} titulo="Custo medio da hora produtiva" onFechar={() => setCfgAberto(false)}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Usado para estimar o custo das obrigacoes (horas previstas x custo/hora) e calcular a margem.</p>
          <label className="block text-sm text-slate-600">Custo por hora (R$)
            <input className="input mt-1 w-full" type="number" min={0} step="0.01" value={custoHora} onChange={(e) => setCustoHora(e.target.value)} />
          </label>
          <div className="flex justify-end"><button className="btn-primary" onClick={salvarConfig}>Salvar</button></div>
        </div>
      </Modal>
    </div>
  );
}

function Kpi({ titulo, valor, icone: Icone, cor, sub }: { titulo: string; valor: string; icone: typeof DollarSign; cor: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{titulo}</div>
        <Icone size={18} className={cor} />
      </div>
      <div className={`mt-1 text-xl font-bold ${cor}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
function Sem() { return <div className="grid h-[200px] place-items-center text-sm text-slate-400">Sem dados.</div>; }
