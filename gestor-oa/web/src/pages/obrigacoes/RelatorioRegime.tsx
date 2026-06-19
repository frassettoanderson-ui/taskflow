import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Landmark, RotateCcw, Printer } from 'lucide-react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';

interface LinhaObr { regime: string; departamento: string; obrigacao: string }
interface LinhaEmp { regime: string; razaoSocial: string; cnpj: string; fone: string }
// estrutura parcial do /regimes usada aqui
interface RegimeRel { id: string; nome: string; obrigacoes?: { obrigacao?: { nome?: string; departamento?: { nome?: string } | null } }[] }

export default function RelatorioRegime() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tipo = params.get('tipo') === 'empresas' ? 'empresas' : 'obrigacoes';
  const regimeId = params.get('regimeId') ?? '';
  const regimeNome = params.get('regimeNome') ?? '';

  const [obr, setObr] = useState<LinhaObr[]>([]);
  const [emp, setEmp] = useState<LinhaEmp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tipo === 'empresas') {
      api.get<LinhaEmp[]>(`/regimes/relatorio/empresas${regimeId ? `?regimeId=${regimeId}` : ''}`)
        .then(setEmp).catch(() => setEmp([])).finally(() => setLoading(false));
    } else {
      api.get<RegimeRel[]>('/regimes').then((regimes) => {
        const out: LinhaObr[] = [];
        for (const r of regimes) {
          if (regimeId && r.id !== regimeId) continue;
          for (const l of r.obrigacoes ?? []) {
            out.push({ regime: r.nome, departamento: l.obrigacao?.departamento?.nome ?? '—', obrigacao: l.obrigacao?.nome ?? '' });
          }
        }
        setObr(out);
      }).catch(() => setObr([])).finally(() => setLoading(false));
    }
  }, [tipo, regimeId]);

  const titulo = tipo === 'empresas' ? 'Relatorio de empresas por regime' : 'Relatorio de obrigacoes por regime';
  const total = tipo === 'empresas' ? emp.length : obr.length;

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Landmark size={16} className="text-slate-400" />
          <span>Obrigacoes</span><span className="text-slate-300">›</span>
          <span className="text-slate-700">Relacao de regimes tributarios</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-slate-700">{titulo} {regimeNome && <span className="text-slate-400">(somente <span className="text-marca-600">{regimeNome}</span>)</span>}</h2>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600"><Printer size={15} /> Imprimir</button>
          <button onClick={() => navigate('/obrigacoes/regimes')} className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={15} /> Voltar</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="mx-auto max-w-3xl rounded border border-slate-300 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-center text-[14px] font-bold text-slate-700">
            {tipo === 'empresas' ? 'Relacao de Empresas e seus Regimes Tributarios' : 'Relacao de Obrigacoes dos Regimes Tributarios'}
          </h3>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-50 text-left font-semibold text-slate-700">
                {tipo === 'empresas' ? (
                  <><th className="border border-slate-200 px-2 py-1">Regime</th><th className="border border-slate-200 px-2 py-1">Razao Social</th><th className="border border-slate-200 px-2 py-1">CNPJ</th><th className="border border-slate-200 px-2 py-1">Fone</th></>
                ) : (
                  <><th className="border border-slate-200 px-2 py-1">Regime</th><th className="border border-slate-200 px-2 py-1">Departamento</th><th className="border border-slate-200 px-2 py-1">Obrigacao</th></>
                )}
              </tr>
            </thead>
            <tbody>
              {tipo === 'empresas'
                ? emp.map((l, i) => <tr key={i} className="text-slate-600"><td className="border border-slate-200 px-2 py-1">{l.regime}</td><td className="border border-slate-200 px-2 py-1">{l.razaoSocial}</td><td className="border border-slate-200 px-2 py-1">{l.cnpj}</td><td className="border border-slate-200 px-2 py-1">{l.fone}</td></tr>)
                : obr.map((l, i) => <tr key={i} className="text-slate-600"><td className="border border-slate-200 px-2 py-1">{l.regime}</td><td className="border border-slate-200 px-2 py-1">{l.departamento}</td><td className="border border-slate-200 px-2 py-1">{l.obrigacao}</td></tr>)}
              {total === 0 && <tr><td colSpan={tipo === 'empresas' ? 4 : 3} className="px-2 py-4 text-center text-slate-400">Nenhum registro.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 text-center text-slate-500"><td colSpan={tipo === 'empresas' ? 4 : 3} className="border border-slate-200 px-2 py-1">{tipo === 'empresas' ? 'Empresas' : 'Obrigacoes'} listadas: {total}</td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
