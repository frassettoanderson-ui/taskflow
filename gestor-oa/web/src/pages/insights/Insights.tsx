import { useEffect, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Building2, CheckCircle2, Clock, AlertTriangle, GitBranch, MessageSquare, FileText,
  Settings2, X, GripVertical, Plus, Maximize2, Minimize2,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Spinner, Modal, useToast } from '../../components/ui';

interface WidgetCfg { id: string; tipo: string; w: number }
interface WidgetDisp { tipo: string; titulo: string; grupo: string }
interface Dados {
  periodo: string;
  kpis: { empresasAtivas: number; entregasBaixadas: number; aRealizar: number; atrasadas: number; processosAndamento: number; solicitacoesAbertas: number; docsTotal: number };
  entregasPorStatus: { nome: string; valor: number; cor: string }[];
  porDepartamento: { nome: string; baixadas: number; pendentes: number }[];
  porColaborador: { nome: string; baixadas: number; pendentes: number }[];
  evolucao: { competencia: string; baixadas: number; atrasadas: number; total: number }[];
  topPendencias: { empresa: string; pendentes: number }[];
}

const KPI_META: Record<string, { titulo: string; campo: keyof Dados['kpis']; icone: typeof Building2; cor: string }> = {
  kpi_empresas: { titulo: 'Empresas ativas', campo: 'empresasAtivas', icone: Building2, cor: 'text-marca-600' },
  kpi_entregas_baixadas: { titulo: 'Entregas baixadas', campo: 'entregasBaixadas', icone: CheckCircle2, cor: 'text-emerald-600' },
  kpi_a_realizar: { titulo: 'A realizar', campo: 'aRealizar', icone: Clock, cor: 'text-amber-600' },
  kpi_atrasadas: { titulo: 'Atrasadas', campo: 'atrasadas', icone: AlertTriangle, cor: 'text-red-600' },
  kpi_processos: { titulo: 'Processos em andamento', campo: 'processosAndamento', icone: GitBranch, cor: 'text-violet-600' },
  kpi_solicitacoes: { titulo: 'Solicitacoes em aberto', campo: 'solicitacoesAbertas', icone: MessageSquare, cor: 'text-sky-600' },
  kpi_docs: { titulo: 'Documentos no GED', campo: 'docsTotal', icone: FileText, cor: 'text-slate-600' },
};

export default function Insights() {
  const toast = useToast();
  const [layout, setLayout] = useState<WidgetCfg[]>([]);
  const [disponiveis, setDisponiveis] = useState<WidgetDisp[]>([]);
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const [meses, setMeses] = useState(6);
  const arrastando = useRef<number | null>(null);

  useEffect(() => {
    api.get<{ layout: WidgetCfg[]; disponiveis: WidgetDisp[] }>('/insights/dashboard').then((d) => {
      setLayout(d.layout); setDisponiveis(d.disponiveis);
    });
  }, []);
  useEffect(() => {
    setLoading(true);
    api.get<Dados>(`/insights/dados?meses=${meses}`).then(setDados).finally(() => setLoading(false));
  }, [meses]);

  async function salvar() {
    try {
      await api.put('/insights/dashboard', { layout });
      setEditando(false);
      toast('ok', 'Painel salvo.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
  }

  function adicionar(tipo: string) {
    setLayout((l) => [...l, { id: `w${Date.now()}`, tipo, w: 1 }]);
    setPaletaAberta(false);
  }
  function remover(id: string) { setLayout((l) => l.filter((w) => w.id !== id)); }
  function alternarLargura(id: string) { setLayout((l) => l.map((w) => (w.id === id ? { ...w, w: w.w === 2 ? 1 : 2 } : w))); }

  function onDrop(destino: number) {
    const origem = arrastando.current;
    if (origem === null || origem === destino) return;
    setLayout((l) => {
      const novo = [...l];
      const [item] = novo.splice(origem, 1);
      novo.splice(destino, 0, item);
      return novo;
    });
    arrastando.current = null;
  }

  if (!dados) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Insights</h1>
          <p className="text-sm text-slate-500">Painel do mes {dados.periodo}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-32" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
          {editando ? (
            <>
              <button className="btn-ghost border border-slate-300" onClick={() => setPaletaAberta(true)}><Plus size={16} /> Adicionar</button>
              <button className="btn-primary" onClick={salvar}>Salvar painel</button>
            </>
          ) : (
            <button className="btn-ghost border border-slate-300" onClick={() => setEditando(true)}><Settings2 size={16} /> Personalizar</button>
          )}
        </div>
      </div>

      {editando && (
        <div className="rounded-md border border-dashed border-marca-300 bg-marca-50 px-3 py-2 text-sm text-marca-700">
          Modo edicao: arraste pelo <GripVertical size={14} className="inline" /> para reordenar, use os botoes para redimensionar/remover e clique em Salvar.
        </div>
      )}

      {loading && <div className="text-sm text-slate-400">Atualizando dados...</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {layout.map((w, i) => (
          <div
            key={w.id}
            className={`${w.w === 2 ? 'md:col-span-2' : ''} ${editando ? 'ring-1 ring-marca-200' : ''} card relative p-4`}
            draggable={editando}
            onDragStart={() => (arrastando.current = i)}
            onDragOver={(e) => editando && e.preventDefault()}
            onDrop={() => onDrop(i)}
          >
            {editando && (
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                <span className="cursor-grab text-slate-300"><GripVertical size={16} /></span>
                <button className="text-slate-400 hover:text-marca-600" title="Redimensionar" onClick={() => alternarLargura(w.id)}>
                  {w.w === 2 ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                <button className="text-slate-400 hover:text-red-600" title="Remover" onClick={() => remover(w.id)}><X size={16} /></button>
              </div>
            )}
            <Widget tipo={w.tipo} dados={dados} />
          </div>
        ))}
        {layout.length === 0 && (
          <div className="md:col-span-2 card p-10 text-center text-slate-400">
            Nenhum widget. Clique em <b>Personalizar</b> e depois em <b>Adicionar</b>.
          </div>
        )}
      </div>

      <Modal aberto={paletaAberta} titulo="Adicionar widget" onFechar={() => setPaletaAberta(false)} largura="max-w-lg">
        <div className="space-y-4">
          {['Indicadores', 'Graficos', 'Listas'].map((grupo) => (
            <div key={grupo}>
              <div className="mb-1 text-xs font-semibold uppercase text-slate-400">{grupo}</div>
              <div className="flex flex-wrap gap-2">
                {disponiveis.filter((d) => d.grupo === grupo).map((d) => (
                  <button key={d.tipo} className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-marca-400 hover:bg-marca-50" onClick={() => adicionar(d.tipo)}>
                    + {d.titulo}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Widget({ tipo, dados }: { tipo: string; dados: Dados }) {
  if (tipo.startsWith('kpi_')) {
    const meta = KPI_META[tipo];
    if (!meta) return <Vazio />;
    const Icone = meta.icone;
    return (
      <div className="flex items-center gap-4">
        <div className={`grid h-12 w-12 place-items-center rounded-full bg-slate-100 ${meta.cor}`}><Icone size={24} /></div>
        <div>
          <div className="text-3xl font-bold text-slate-800">{dados.kpis[meta.campo]}</div>
          <div className="text-sm text-slate-500">{meta.titulo}</div>
        </div>
      </div>
    );
  }

  if (tipo === 'chart_entregas_status') {
    const data = dados.entregasPorStatus.filter((d) => d.valor > 0);
    return (
      <Bloco titulo="Entregas por status (mes atual)">
        {data.length === 0 ? <SemDados /> : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={80} label>
                {data.map((d, i) => <Cell key={i} fill={d.cor} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Bloco>
    );
  }

  if (tipo === 'chart_por_departamento') {
    return (
      <Bloco titulo="Entregas por departamento (mes atual)">
        {dados.porDepartamento.length === 0 ? <SemDados /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dados.porDepartamento}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="nome" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="baixadas" name="Baixadas" fill="#5b9bd5" stackId="a" />
              <Bar dataKey="pendentes" name="Pendentes" fill="#f0ad4e" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Bloco>
    );
  }

  if (tipo === 'chart_por_colaborador') {
    return (
      <Bloco titulo="Entregas por colaborador (mes atual)">
        {dados.porColaborador.length === 0 ? <SemDados /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dados.porColaborador} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" fontSize={11} allowDecimals={false} /><YAxis type="category" dataKey="nome" fontSize={11} width={100} /><Tooltip /><Legend />
              <Bar dataKey="baixadas" name="Baixadas" fill="#5b9bd5" stackId="a" />
              <Bar dataKey="pendentes" name="Pendentes" fill="#f0ad4e" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Bloco>
    );
  }

  if (tipo === 'chart_evolucao') {
    return (
      <Bloco titulo="Evolucao mensal">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dados.evolucao}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="competencia" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="total" name="Total" stroke="#94a3b8" />
            <Line type="monotone" dataKey="baixadas" name="Baixadas" stroke="#5cb85c" />
            <Line type="monotone" dataKey="atrasadas" name="Atrasadas" stroke="#cf3c5d" />
          </LineChart>
        </ResponsiveContainer>
      </Bloco>
    );
  }

  if (tipo === 'list_top_pendencias') {
    return (
      <Bloco titulo="Top empresas com pendencias (mes atual)">
        {dados.topPendencias.length === 0 ? <SemDados /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {dados.topPendencias.map((p, i) => (
              <li key={i} className="flex items-center justify-between py-1.5">
                <span className="truncate text-slate-600">{p.empresa}</span>
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{p.pendentes}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    );
  }

  return <Vazio />;
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{titulo}</h3>
      {children}
    </div>
  );
}
function SemDados() { return <div className="grid h-[200px] place-items-center text-sm text-slate-400">Sem dados no periodo.</div>; }
function Vazio() { return <div className="text-sm text-slate-400">Widget desconhecido.</div>; }
