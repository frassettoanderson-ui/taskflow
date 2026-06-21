import { Fragment, useEffect, useState } from 'react';
import { PieChart, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';

interface ContatoNps { nome: string; avaliacoes: number; media: number; ultima: string }
interface EmpresaNps { id: string; nome: string; detratores: number; neutros: number; promotores: number; avaliacoes: number; media: number; contatos: ContatoNps[] }
interface Cards { detratoras: number; neutras: number; promotoras: number; nps: number }
interface NpsResp { cards: Cards; empresas: EmpresaNps[] }

const COR = { detr: '#d15b47', neut: '#ffb752', prom: '#88b87f', nps: '#69a8d9' };
const dt = (s: string) => new Date(s).toLocaleString('pt-BR');

function Estrelas({ media }: { media: number }) {
  const cheias = Math.round(media); // 0..10
  return (
    <span className="whitespace-nowrap text-[13px] leading-none">
      {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < cheias ? 'text-emerald-500' : 'text-slate-300'}>★</span>)}
    </span>
  );
}

function CardNps({ cor, pct, label, onClick }: { cor: string; pct: number; label: string; onClick?: () => void }) {
  const r = 22, c = 2 * Math.PI * r, arc = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <button onClick={onClick} className="flex flex-1 items-center gap-3 rounded p-3 text-left text-white transition hover:opacity-95" style={{ background: cor }}>
      <div className="relative h-14 w-14 shrink-0">
        <svg width="56" height="56" className="-rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="5" />
          <circle cx="28" cy="28" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeDasharray={`${arc} ${c - arc}`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[12px] font-bold">{pct}%</span>
      </div>
      <span className="text-[14px] font-semibold leading-tight">{label}</span>
    </button>
  );
}

export default function NpsPanel() {
  const [d, setD] = useState<NpsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [flags, setFlags] = useState({ detr: true, neut: true, prom: true });
  const [abertoId, setAbertoId] = useState<string | null>(null);

  useEffect(() => {
    api.get<NpsResp>('/gestao-portal/nps')
      .then(setD)
      .catch(() => setD({ cards: { detratoras: 0, neutras: 0, promotoras: 0, nps: 0 }, empresas: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!d) return null;

  const termo = busca.trim().toLowerCase();
  const lista = d.empresas.filter((e) => {
    if (termo && !e.nome.toLowerCase().includes(termo) && !e.id.toLowerCase().includes(termo)) return false;
    return (e.detratores > 0 && flags.detr) || (e.neutros > 0 && flags.neut) || (e.promotores > 0 && flags.prom);
  });

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* breadcrumb */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <PieChart size={16} className="text-slate-400" />
          <span className="text-slate-400">Sistema</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-400">Aplicativo e Area VIP</span><span className="text-slate-300">&rsaquo;</span>
          <span className="font-medium text-slate-700">NPS - Net Promoter Score</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* titulo */}
      <div className="mb-3 text-center">
        <h1 className="text-[20px] font-bold text-status-danger">Net Promoter Score</h1>
        <button className="text-[14px] font-semibold text-marca-600 hover:underline" onClick={() => window.open('https://www.netpromoter.com/know/', '_blank')}>(Clique aqui e saiba mais sobre NPS)</button>
      </div>

      {/* cards coloridos: clicar filtra a tabela pela categoria */}
      <div className="mb-3 flex flex-wrap gap-2">
        <CardNps cor={COR.detr} pct={d.cards.detratoras} label="Empresas Detratoras" onClick={() => setFlags({ detr: true, neut: false, prom: false })} />
        <CardNps cor={COR.neut} pct={d.cards.neutras} label="Empresas Neutras" onClick={() => setFlags({ detr: false, neut: true, prom: false })} />
        <CardNps cor={COR.prom} pct={d.cards.promotoras} label="Empresas Promotoras" onClick={() => setFlags({ detr: false, neut: false, prom: true })} />
        <CardNps cor={COR.nps} pct={d.cards.nps} label="NPS" onClick={() => setFlags({ detr: true, neut: true, prom: true })} />
      </div>

      {/* filtro + flags */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-400" />
          <input className="w-full rounded border border-marca-300 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-marca-500" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar empresa (ID ou Nome)" />
        </div>
        <span className="text-[13px] text-slate-600">Somente:</span>
        <label className="flex items-center gap-1 text-[13px] text-slate-600"><input type="checkbox" checked={flags.detr} onChange={(e) => setFlags((f) => ({ ...f, detr: e.target.checked }))} /> Detratores</label>
        <label className="flex items-center gap-1 text-[13px] text-slate-600"><input type="checkbox" checked={flags.neut} onChange={(e) => setFlags((f) => ({ ...f, neut: e.target.checked }))} /> Neutros</label>
        <label className="flex items-center gap-1 text-[13px] text-slate-600"><input type="checkbox" checked={flags.prom} onChange={(e) => setFlags((f) => ({ ...f, prom: e.target.checked }))} /> Promotores</label>
        <button className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={16} /> Filtrar</button>
      </div>

      {/* tabela */}
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[12px] font-bold text-status-danger">
              <th className="px-3 py-2">Empresa [ID] <span className="font-normal text-marca-600">[{lista.length} reg]</span></th>
              <th className="px-3 py-2 text-center">Detratores</th>
              <th className="px-3 py-2 text-center">Neutros</th>
              <th className="px-3 py-2 text-center">Promotores</th>
              <th className="px-3 py-2 text-center">Avaliacoes</th>
              <th className="px-3 py-2 text-center">Media empresa</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <Fragment key={e.id}>
                <tr className="cursor-pointer border-b border-slate-200 odd:bg-white even:bg-fundo hover:bg-caixa" onClick={() => setAbertoId((id) => id === e.id ? null : e.id)}>
                  <td className="px-3 py-2 font-bold text-slate-700">{e.nome} <span className="font-normal text-slate-400">[{e.id.slice(-5)}]</span></td>
                  <td className="px-3 py-2 text-center text-slate-600">{e.detratores}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{e.neutros}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{e.promotores}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{e.avaliacoes}</td>
                  <td className="px-3 py-2 text-center"><Estrelas media={e.media} /></td>
                </tr>
                {abertoId === e.id && (
                  <tr className="bg-caixa" onClick={(ev) => ev.stopPropagation()}>
                    <td colSpan={6} className="px-3 py-2">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-[12px] font-bold text-status-danger">
                            <th className="px-3 py-1">Usuario [ID]</th>
                            <th className="px-3 py-1 text-center">Ult. avaliacao</th>
                            <th className="px-3 py-1 text-center">Avaliacoes</th>
                            <th className="px-3 py-1 text-center">Media usuario</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.contatos.map((c, i) => (
                            <tr key={i} className="border-t border-slate-200">
                              <td className="px-3 py-1 text-slate-700">{c.nome}</td>
                              <td className="px-3 py-1 text-center text-slate-600">{dt(c.ultima)}</td>
                              <td className="px-3 py-1 text-center text-slate-600">{c.avaliacoes}</td>
                              <td className="px-3 py-1 text-center"><Estrelas media={c.media} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {lista.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Nenhuma avaliacao.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
