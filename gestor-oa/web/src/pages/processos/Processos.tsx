import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, SlidersHorizontal, X, RefreshCw, Printer, Search, Plus, Settings } from 'lucide-react';
import { api, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner } from '../../components/ui';
import type { ProcessoLista, StatusProcesso, Departamento, UsuarioBasico } from '../../lib/tipos';

const ROTULO: Record<StatusProcesso, string> = {
  EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluido', SUSPENSO: 'Suspenso', CANCELADO: 'Desistencia',
};
const COR: Record<StatusProcesso, string> = {
  EM_ANDAMENTO: '#5b9bd5', CONCLUIDO: '#5cb85c', SUSPENSO: '#f0ad4e', CANCELADO: '#cf3c5d',
};
const GRUPO: Record<string, StatusProcesso[]> = {
  andamento: ['EM_ANDAMENTO'], concluidos: ['CONCLUIDO'], suspensos: ['SUSPENSO'], desistencias: ['CANCELADO'],
};

function dataBR(d?: string | null): string {
  if (!d) return '-';
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`;
}

const INP = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const DATA_INP = 'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-center text-[12px] text-slate-600 outline-none placeholder:text-slate-400 focus:border-marca-400';

type SortKey = 'numero' | 'titulo' | 'empresa' | 'inicio' | 'dias' | 'gestor';

export default function Processos() {
  const { sessao } = useAuth();
  const navigate = useNavigate();
  const podeOperar = temPermissao(sessao, 'processos_operar');

  const [q, setQ] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [flags, setFlags] = useState({ andamento: true, concluidos: true, suspensos: true, desistencias: true });
  const [d, setD] = useState({ inicioDe: '', inicioAte: '', conclusaoDe: '', conclusaoAte: '' });
  const [sort, setSort] = useState<{ k: SortKey; dir: 'asc' | 'desc' }>({ k: 'numero', dir: 'desc' });

  const [processos, setProcessos] = useState<ProcessoLista[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
  }, []);

  function carregar() {
    setLoading(true);
    const statusList = Object.entries(flags).filter(([, v]) => v).flatMap(([k]) => GRUPO[k]);
    const qs = new URLSearchParams();
    if (q.trim()) qs.set('q', q.trim());
    if (statusList.length) qs.set('statusList', statusList.join(','));
    for (const k of ['inicioDe', 'inicioAte', 'conclusaoDe', 'conclusaoAte'] as const) if (d[k]) qs.set(k, d[k]);
    api.get<ProcessoLista[]>(`/processos?${qs}`).then(setProcessos).catch(() => setProcessos([])).finally(() => setLoading(false));
  }
  useEffect(carregar, [tick]);

  const nomeDepto = useMemo(() => new Map(departamentos.map((x) => [x.id, x.nome])), [departamentos]);
  const nomeUsuario = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);

  const lista = useMemo(() => {
    const arr = [...processos];
    const m = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let va: string | number = '', vb: string | number = '';
      if (sort.k === 'numero') { va = a.numero ?? 0; vb = b.numero ?? 0; }
      else if (sort.k === 'titulo') { va = (a.titulo ?? a.nome).toLowerCase(); vb = (b.titulo ?? b.nome).toLowerCase(); }
      else if (sort.k === 'empresa') { va = (a.empresa?.razaoSocial ?? '').toLowerCase(); vb = (b.empresa?.razaoSocial ?? '').toLowerCase(); }
      else if (sort.k === 'inicio') { va = a.dataInicio; vb = b.dataInicio; }
      else if (sort.k === 'dias') { va = a.diasCorridos; vb = b.diasCorridos; }
      else if (sort.k === 'gestor') { va = (nomeUsuario.get(a.gestorId ?? '') ?? '').toLowerCase(); vb = (nomeUsuario.get(b.gestorId ?? '') ?? '').toLowerCase(); }
      return va < vb ? -m : va > vb ? m : 0;
    });
    return arr;
  }, [processos, sort, nomeUsuario]);

  function ordenar(k: SortKey) { setSort((s) => (s.k === k ? { k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { k, dir: 'asc' })); }
  const seta = (k: SortKey) => (sort.k === k ? (sort.dir === 'asc' ? ' ↓' : ' ↑') : '');

  function exportar() {
    fetch('/api/v1/processos/export', { headers: { Authorization: `Bearer ${getAccessToken()}` } })
      .then((r) => r.blob()).then((b) => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'processos.csv'; a.click(); URL.revokeObjectURL(u); });
  }

  const Flag = ({ k, label }: { k: keyof typeof flags; label: string }) => (
    <label className="flex cursor-pointer select-none items-center gap-1.5">
      <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))} className="accent-marca-600" />
      <span className="text-[12px] font-medium text-slate-600">{label}</span>
    </label>
  );

  const COLS = 'grid grid-cols-[1.7fr_2.1fr_1.2fr] gap-3';

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-4 text-[13px]">
      {/* cabecalho */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <CheckCircle2 size={16} className="text-slate-400" />
          <span className="font-medium text-slate-700">Gestao de processos</span>
          <span className="text-slate-400">[F10]</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* barra */}
      <div className="rounded border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${INP} w-72`} placeholder="Filtrar ID/Empresa/Obs/Titulo" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setTick((t) => t + 1)} />
          <button onClick={() => setMostrarFiltros((v) => !v)}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-[12px] font-medium text-white ${mostrarFiltros ? 'bg-status-danger hover:bg-red-600' : 'bg-marca-400 hover:bg-marca-500'}`}>
            {mostrarFiltros ? <X size={14} /> : <SlidersHorizontal size={14} />} +Filtros
          </button>
          <div className="flex items-center gap-3 pl-2">
            <Flag k="andamento" label="Em andamento" />
            <Flag k="concluidos" label="Concluidos" />
            <Flag k="suspensos" label="Suspensos" />
            <Flag k="desistencias" label="Desistencias" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button title="Atualizar" onClick={() => setTick((t) => t + 1)} className="grid h-8 w-8 place-items-center rounded text-status-ok hover:bg-emerald-50"><RefreshCw size={16} /></button>
            <button title="Imprimir" onClick={exportar} className="grid h-8 w-8 place-items-center rounded text-marca-600 hover:bg-marca-50"><Printer size={16} /></button>
            <span className="px-1 text-[12px] text-marca-600">&laquo; {processos.length} reg &raquo;</span>
          </div>
        </div>

        {/* datas + acoes */}
        <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto_auto]">
          <input type="date" className={DATA_INP} value={d.inicioDe} onChange={(e) => setD((s) => ({ ...s, inicioDe: e.target.value }))} title="Data de inicio de" />
          <input type="date" className={DATA_INP} value={d.inicioAte} onChange={(e) => setD((s) => ({ ...s, inicioAte: e.target.value }))} title="Data de inicio ate" />
          <input type="date" className={DATA_INP} value={d.conclusaoDe} onChange={(e) => setD((s) => ({ ...s, conclusaoDe: e.target.value }))} title="Data de conclusao de" />
          <input type="date" className={DATA_INP} value={d.conclusaoAte} onChange={(e) => setD((s) => ({ ...s, conclusaoAte: e.target.value }))} title="Data de conclusao ate" />
          <button onClick={() => setTick((t) => t + 1)} className="flex items-center justify-center gap-2 rounded bg-status-ok px-4 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-600"><Search size={14} /> Filtrar</button>
          {podeOperar && <button onClick={() => navigate('/processos/novo')} className="flex items-center justify-center gap-2 rounded bg-marca-500 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-marca-600"><Plus size={14} /> Novo</button>}
          <button title="Configurar (matrizes)" onClick={() => navigate('/processos/matrizes')} className="grid place-items-center rounded bg-sky-400 px-4 py-1.5 text-white hover:bg-sky-500"><Settings size={15} /></button>
        </div>

        {mostrarFiltros && (
          <div className="mt-2 border-t border-slate-100 pt-2 text-[12px] text-slate-400">Filtros adicionais em construcao.</div>
        )}
      </div>

      {/* cabecalho de colunas */}
      <div className="mt-2 rounded-t border border-b-0 border-slate-200 bg-white px-3 py-2">
        <div className={COLS}>
          <div className="text-[12px] text-slate-500">
            <div>
              <button onClick={() => ordenar('numero')} className="font-semibold text-marca-600 hover:underline">[ID]{seta('numero')}</button>{' '}
              <button onClick={() => ordenar('titulo')} className="font-semibold text-marca-600 hover:underline">Processo</button>{' '}
              <span className="text-slate-400">[Departamento]</span>
            </div>
            <div className="font-semibold text-marca-600">Titulo</div>
            <div><button onClick={() => ordenar('empresa')} className="font-semibold text-marca-600 hover:underline">Empresa{seta('empresa')}</button></div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[12px] text-slate-500">
            <div>
              <button onClick={() => ordenar('inicio')} className="font-semibold text-marca-600 hover:underline">Data de Inicio{seta('inicio')}</button>
              <div className="font-semibold text-marca-600">Conclusao/Previsao</div>
              <div className="font-semibold text-slate-600">Status</div>
            </div>
            <div>
              <button onClick={() => ordenar('dias')} className="font-semibold text-slate-700 hover:underline">Dias corridos{seta('dias')}</button>
              <div><button onClick={() => ordenar('gestor')} className="font-semibold text-marca-600 hover:underline">Gestor do Processo{seta('gestor')}</button></div>
            </div>
          </div>
          <div className="text-[12px] font-semibold text-marca-600">Observacoes</div>
        </div>
      </div>

      {/* linhas */}
      <div className="overflow-hidden rounded-b border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="py-12"><Spinner /></div>
          : lista.length === 0 ? <div className="px-3 py-12 text-center text-slate-400">Nenhum processo para os filtros selecionados.</div>
          : lista.map((p) => {
            const dep = p.departamentoId ? nomeDepto.get(p.departamentoId) : null;
            const gestor = p.gestorId ? nomeUsuario.get(p.gestorId) ?? '-' : '-';
            return (
              <div key={p.id} onClick={() => navigate(`/processos/${p.id}`)} className="cursor-pointer border-b border-slate-100 px-3 py-2.5 hover:bg-slate-50">
                <div className={COLS}>
                  {/* col 1 */}
                  <div>
                    <div className="text-slate-700">
                      <span className="text-slate-400">[{p.numero ?? '-'}]</span> <span className="font-medium">{p.nome}</span>
                      {dep && <span className="text-marca-600"> [{dep}]</span>}
                    </div>
                    <div className="text-marca-700">{p.titulo}</div>
                    <div className="text-slate-600">{p.empresa?.razaoSocial}<span className="text-slate-400"> [{p.empresa?.numero ?? '-'} | {p.empresa?.cnpjFinal ?? '----'}]</span></div>
                  </div>
                  {/* col 2+3 */}
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-slate-600">{dataBR(p.dataInicio)}</div>
                        <div className="text-status-danger">{dataBR(p.previsaoConclusao)} <span className="text-slate-400">(previsao)</span></div>
                      </div>
                      <div>
                        <div className="font-medium text-slate-700">{p.diasCorridos} dias</div>
                        <div className="text-marca-700">{gestor}</div>
                      </div>
                    </div>
                    {/* barra de progresso (status) */}
                    <div className="mt-1.5 h-5 w-full overflow-hidden rounded-full" style={{ background: COR[p.status] + '22' }}>
                      <div className="flex h-full items-center justify-center rounded-full text-[11px] font-medium text-white" style={{ width: `${Math.max(p.progresso, 8)}%`, background: COR[p.status] }}>
                        {p.progresso}% - {ROTULO[p.status]}
                      </div>
                    </div>
                  </div>
                  {/* col 4 */}
                  <div>
                    <div className="min-h-[44px] rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">{p.observacoes}</div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
