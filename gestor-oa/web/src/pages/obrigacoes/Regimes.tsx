import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Search, Printer, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import { relatorioEmpresasPorRegime, relatorioObrigacoesPorRegime } from '../../lib/relatorioPdf';
import type { Regime } from '../../lib/tipos';

export default function Regimes() {
  const { sessao } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');

  function gerarPdf(fn: () => Promise<void>) {
    setImprimirAberto(false);
    fn().catch(() => toast('erro', 'Falha ao gerar o relatorio.'));
  }
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [imprimirAberto, setImprimirAberto] = useState(false);
  const imprimirRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Regime[]>('/regimes').then(setRegimes).catch(() => setRegimes([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    function fora(e: MouseEvent) { if (imprimirRef.current && !imprimirRef.current.contains(e.target as Node)) setImprimirAberto(false); }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  if (loading) return <Spinner />;

  const lista = regimes.filter((r) => {
    const statusOk = status === 'todos' ? true : status === 'ativos' ? r.ativo : !r.ativo;
    const buscaOk = !busca.trim() || r.nome.toLowerCase().includes(busca.trim().toLowerCase());
    return statusOk && buscaOk;
  });

  return (
    <div className="-m-6 min-h-full bg-fundo p-5 text-[13px]">
      {/* Cabecalho */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Landmark size={16} className="text-slate-400" />
          <span>Obrigacoes</span><span className="text-slate-300">›</span>
          <span className="text-slate-700">Relacao de regimes tributarios</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-400" />
          <input className="w-full rounded border border-marca-300 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-marca-500" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar pelo nome [Enter para filtrar]" />
        </div>
        <select className="rounded border border-slate-300 bg-white px-2 py-2 text-[12px]" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <button className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={16} /> Filtrar</button>
        <div className="flex-1 text-center text-[13px] font-medium text-marca-600">{lista.length} registros</div>
        <div className="relative" ref={imprimirRef}>
          <button title="Imprimir" onClick={() => setImprimirAberto((v) => !v)} className="text-marca-600 hover:text-marca-800"><Printer size={18} /></button>
          {imprimirAberto && (
            <div className="absolute right-0 top-8 z-50 flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
              <button onClick={() => gerarPdf(() => relatorioEmpresasPorRegime())} className="flex items-center gap-2 whitespace-nowrap rounded bg-roxo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-roxo-600"><Printer size={13} /> Empresas por regime</button>
              <button onClick={() => gerarPdf(() => relatorioObrigacoesPorRegime())} className="flex items-center gap-2 whitespace-nowrap rounded bg-amber-400 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"><Printer size={13} /> Obrigacoes por regime</button>
            </div>
          )}
        </div>
        {podeGerenciar && (
          <button onClick={() => navigate('/obrigacoes/regimes/novo')} className="flex items-center gap-2 rounded bg-marca-500 px-5 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo regime</button>
        )}
      </div>

      {/* Tabela */}
      <div className="mt-3 overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
              <th className="px-4 py-2.5">Regime tributario</th>
              <th className="px-4 py-2.5">Obrigacoes</th>
              <th className="px-4 py-2.5">Empresas</th>
              <th className="px-4 py-2.5 text-right">Ativo?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <button onClick={() => navigate(`/obrigacoes/regimes/${r.id}`)} className="text-marca-600 hover:underline">{r.nome}{!r.ativo && <span className="text-slate-400"> [inativo]</span>}</button>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-slate-600">{r.obrigacoes.length}
                    <button title="Relacao de obrigacoes desse regime" onClick={() => gerarPdf(() => relatorioObrigacoesPorRegime(r.id))} className="text-marca-400 hover:text-marca-600"><Printer size={14} /></button>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-slate-600">{r._count?.empresas ?? 0}
                    <button title="Relacao de empresas desse regime" onClick={() => gerarPdf(() => relatorioEmpresasPorRegime(r.id))} className="text-marca-400 hover:text-marca-600"><Printer size={14} /></button>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-slate-600">{r.ativo ? 'Sim' : 'Nao'}</td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Nenhum regime.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
