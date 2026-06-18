import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Landmark, List, Cog, Search, Plus } from 'lucide-react';
import { api, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { Obrigacao, Departamento, EntregaMes } from '../../lib/tipos';
import { LABEL_COMPETENCIA } from '../../lib/tipos';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function rotuloMes(m: EntregaMes): string | null {
  if (!m || m.modo === 'NAO_ENTREGA') return null;
  if (m.modo === 'ULT_DIA_UTIL') return 'UltDU';
  if (m.modo === 'DIA_UTIL') return `${m.dia}ºDU`;
  return String(m.dia ?? '');
}

// Datas de entrega a partir do entregaMeses; fallback simples se vazio.
function datasEntrega(o: Obrigacao): string[] {
  const meses = Array.isArray(o.entregaMeses) ? o.entregaMeses : [];
  if (meses.length === 12) {
    const out: string[] = [];
    meses.forEach((m, i) => { const r = rotuloMes(m); if (r) out.push(`${r}/${MESES[i]}`); });
    return out;
  }
  // fallback: usa periodicidade + regraPrazo
  const dia = o.regraPrazo?.tipoDia === 'DIA_UTIL' ? `${o.regraPrazo.dia}ºDU` : String(o.regraPrazo?.dia ?? '');
  const idx = o.periodicidade === 'MENSAL' ? [0,1,2,3,4,5,6,7,8,9,10,11] : o.periodicidade === 'TRIMESTRAL' ? [0,3,6,9] : o.periodicidade === 'ANUAL' ? [0] : [];
  return idx.map((i) => `${dia}/${MESES[i]}`);
}

export default function Catalogo() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');

  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroDep, setFiltroDep] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativas' | 'inativas' | 'todas'>('ativas');
  const [imprimirAberto, setImprimirAberto] = useState(false);
  const imprimirRef = useRef<HTMLDivElement>(null);

  function carregar() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filtroDep) qs.set('departamentoId', filtroDep);
    if (busca.trim()) qs.set('busca', busca.trim());
    api.get<Obrigacao[]>(`/obrigacoes?${qs}`).then(setObrigacoes).finally(() => setLoading(false));
  }
  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
  }, []);
  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroDep, busca]);
  useEffect(() => {
    function fora(e: MouseEvent) { if (imprimirRef.current && !imprimirRef.current.contains(e.target as Node)) setImprimirAberto(false); }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  async function exportarExcel() {
    setImprimirAberto(false);
    const res = await fetch('/api/v1/obrigacoes/export', { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!res.ok) return toast('erro', 'Falha ao exportar.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'obrigacoes.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const lista = obrigacoes.filter((o) =>
    status === 'todas' ? true : status === 'ativas' ? o.ativo : !o.ativo,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar obrigacao" />
        </div>

        <div className="text-sm text-marca-600">{lista.length} reg</div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={imprimirRef}>
            <button title="Imprimir obrigacoes" className="text-marca-600 hover:text-marca-800" onClick={() => setImprimirAberto((v) => !v)}>
              <Printer size={20} />
            </button>
            {imprimirAberto && (
              <div className="absolute left-0 top-7 z-50 flex gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                <button className="rounded bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600" onClick={() => { setImprimirAberto(false); toast('ok', 'Exportacao PDF: em breve'); }}>PDF</button>
                <button className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700" onClick={exportarExcel}>EXCEL</button>
              </div>
            )}
          </div>
          <button title="Configurar regimes tributarios" className="text-marca-600 hover:text-marca-800" onClick={() => navigate('/obrigacoes/regimes')}><Landmark size={20} /></button>
          <button title="Grupos de obrigacoes" className="text-marca-600 hover:text-marca-800" onClick={() => navigate('/obrigacoes/grupos')}><List size={20} /></button>
          <button title="Configurar feriados" className="text-orange-500 hover:text-orange-600" onClick={() => navigate('/obrigacoes/feriados')}><Cog size={20} /></button>
        </div>

        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="ativas">Apenas ativas</option>
          <option value="inativas">Exibir inativas</option>
          <option value="todas">Todas</option>
        </select>
        <select className="input w-48" value={filtroDep} onChange={(e) => setFiltroDep(e.target.value)}>
          <option value="">Todos os departamentos</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>

        {podeGerenciar && (
          <button className="btn-primary" onClick={() => navigate('/obrigacoes/nova')}><Plus size={16} /> Nova obrigacao</button>
        )}
      </div>

      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Obrigacao / Departamento / Qtde empresas</th>
                <th className="px-3 py-2">Datas para entrega (DU = Dia Util)</th>
                <th className="px-3 py-2">Multa? / Robo?</th>
                <th className="px-3 py-2">Compet. / Lembrar</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => {
                const datas = datasEntrega(o);
                return (
                  <tr
                    key={o.id}
                    className="cursor-pointer border-b border-slate-100 align-top hover:bg-slate-50"
                    onClick={() => navigate(`/obrigacoes/${o.id}`)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-marca-700">
                        {o.nome} {!o.ativo && <span className="text-red-500">[Inativa]</span>}
                      </div>
                      <div className="text-xs text-slate-500">{o.departamento?.nome ?? '—'}</div>
                      <div className="text-xs text-slate-400">{o._count?.empresaObrigacoes ?? 0} empresas</div>
                    </td>
                    <td className="px-3 py-2">
                      {datas.length === 0 ? (
                        <span className="text-xs text-slate-400">Eventual</span>
                      ) : (
                        <div className="flex max-w-md flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px] text-slate-500">
                          {datas.map((d, i) => <span key={i}>{d}</span>)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      <div>Multa? <span className={o.passivelMulta ? 'text-red-500' : 'text-slate-400'}>{o.passivelMulta ? 'Sim' : 'Nao'}</span></div>
                      <div>Robo? <span className={o.exigeBaixaPeloRobo ? 'text-marca-600' : 'text-slate-400'}>{o.exigeBaixaPeloRobo ? 'Sim' : 'Nao'}</span></div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      <div>{LABEL_COMPETENCIA[o.competenciaRef] ?? 'Mes anterior'}</div>
                      <div className="text-slate-400">{o.lembrarDiasAntes ?? 0} dias antes</div>
                    </td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-400">Nenhuma obrigacao.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
