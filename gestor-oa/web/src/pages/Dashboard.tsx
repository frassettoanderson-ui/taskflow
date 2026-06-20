import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  User,
  Network,
  Pencil,
  Gauge,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Donut, type Segmento } from '../components/Donut';
import { Spinner } from '../components/ui';
import PainelPlayer from './dashboard/PainelPlayer';
import type { PainelDef } from '../lib/tipos';

interface Metrica {
  count: number;
  pct: number;
}
interface MetricasEntrega {
  pendenteAntecipado: Metrica;
  pendenteNoPrazo: Metrica;
  entregueNoPrazo: Metrica;
  entregueComMulta: Metrica;
}
interface Painel {
  periodo: string;
  colaboradores: { id: string; nome: string; metricas: MetricasEntrega }[];
  departamentos: { id: string; nome: string; cor: string; metricas: MetricasEntrega }[];
  numericos: {
    entregas: { total: number; antecipadas: Metrica; prazoTecnico: Metrica; atrasadas: Metrica; comMulta: Metrica; atrasoJustificado: Metrica };
    aRealizar: { total: number; prazoAntecipado: Metrica; prazoTecnico: Metrica; atrasoLegal: Metrica; comMulta: Metrica; atrasoJustificado: Metrica };
    docs: { total: number; lidos: Metrica; naoLidos: Metrica };
    processos: { total: number; iniciados: Metrica; concluidos: Metrica; passosOk: Metrica; followups: Metrica };
    solicitacoes: { total: number; abertas: number; finalizadas: number; aguardando: number; resolvendo: number; mediaAvaliacoes: number };
    empresas: number;
  };
}

const COR = {
  ok: '#5cb85c',
  info: '#5b9bd5',
  infoClaro: '#9cc3e4',
  danger: '#cf3c5d',
  warn: '#f0ad4e',
};

const VISOES = [
  'Insights por colaborador',
  'Insights por departamento',
  'Insights numericos',
] as const;

export default function Dashboard() {
  const { sessao } = useAuth();
  const [params, setParams] = useSearchParams();
  const [paineis, setPaineis] = useState<PainelDef[]>([]);
  const [preferidoId, setPreferidoId] = useState<string | null>(null);
  const [carregou, setCarregou] = useState(false);

  const painelUrl = params.get('painel');

  useEffect(() => {
    api.get<PainelDef[]>('/dashboard/paineis').then(setPaineis).catch(() => undefined);
    api.get<{ painelPreferidoId: string | null }>('/dashboard/preferido')
      .then((r) => setPreferidoId(r.painelPreferidoId)).catch(() => undefined)
      .finally(() => setCarregou(true));
  }, []);

  // painel ativo: o da URL ou, na 1a carga, o preferido do usuario
  const ativoId = painelUrl ?? (carregou && !params.has('fixo') ? preferidoId : null);
  const nome = sessao?.usuario?.nome?.split(' ')[0] ?? '';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  async function fixarPreferido(id: string | null) {
    setPreferidoId(id);
    await api.put('/dashboard/preferido', { painelId: id }).catch(() => undefined);
  }

  function abrir(id: string) { setParams(id ? { painel: id } : {}); }
  function sair() { setParams({ fixo: '1' }); }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-700">{saudacao}{nome ? `, ${nome}` : ''}!</h2>
        <p className="text-xs text-slate-400">Escolha um painel para exibir ou gerencie seus indicadores.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-600"
          value={ativoId ?? ''} onChange={(e) => (e.target.value ? abrir(e.target.value) : sair())}>
          <option value="">Painel padrao (fixo)</option>
          {paineis.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        {ativoId && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={preferidoId === ativoId} onChange={(e) => fixarPreferido(e.target.checked ? ativoId : null)} />
            Sempre exibir ao iniciar
          </label>
        )}
        <Link to="/dashboard/paineis" title="Gerenciar paineis" className="grid h-8 w-8 place-items-center rounded border border-slate-300 text-slate-500 hover:bg-slate-50"><Pencil size={15} /></Link>
        <Link to="/dashboard/indicadores" title="Gerenciar indicadores" className="grid h-8 w-8 place-items-center rounded border border-slate-300 text-slate-500 hover:bg-slate-50"><Gauge size={15} /></Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {header}
      {ativoId ? <PainelPlayer painelId={ativoId} onSair={sair} /> : <PainelFixo />}
    </div>
  );
}

function PainelFixo() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [visao, setVisao] = useState(0);
  const [tocando, setTocando] = useState(
    () => localStorage.getItem('goa_painel_autostart') !== 'false',
  );
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get<Painel>('/insights/painel').then(setPainel).catch(() => undefined);
  }, []);

  // Auto-rotacao do carrossel
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (tocando) {
      timer.current = setInterval(() => setVisao((v) => (v + 1) % VISOES.length), 9000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [tocando]);

  function toggleAutostart(v: boolean) {
    setTocando(v);
    localStorage.setItem('goa_painel_autostart', String(v));
  }

  if (!painel) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-marca-600">Painel de Indicadores</h1>
        <p className="text-sm font-medium text-status-danger">
          [{VISOES[visao]} / {painel.periodo}]
        </p>
      </div>

      {/* Barra de controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
          <Controle onClick={() => setVisao(0)} title="Primeira"><SkipBack size={16} /></Controle>
          <Controle onClick={() => setVisao((v) => (v - 1 + VISOES.length) % VISOES.length)} title="Anterior"><ChevronLeft size={16} /></Controle>
          <Controle onClick={() => toggleAutostart(!tocando)} title={tocando ? 'Pausar' : 'Reproduzir'}>
            {tocando ? <Pause size={16} /> : <Play size={16} />}
          </Controle>
          <Controle onClick={() => setVisao((v) => (v + 1) % VISOES.length)} title="Proxima"><ChevronRight size={16} /></Controle>
          <Controle onClick={() => setVisao(VISOES.length - 1)} title="Ultima"><SkipForward size={16} /></Controle>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={tocando} onChange={(e) => toggleAutostart(e.target.checked)} />
          Sempre exibir ao iniciar
        </label>
      </div>

      {/* Pontos do carrossel */}
      <div className="flex justify-center gap-2">
        {VISOES.map((_, i) => (
          <button
            key={i}
            onClick={() => setVisao(i)}
            className={`h-2 w-2 rounded-full transition ${i === visao ? 'bg-marca-500' : 'bg-slate-300'}`}
          />
        ))}
      </div>

      {visao === 0 && <VisaoEntidades itens={painel.colaboradores.map((c) => ({ ...c, cor: undefined }))} icone={<User size={56} />} />}
      {visao === 1 && <VisaoEntidades itens={painel.departamentos} icone={<Network size={52} />} />}
      {visao === 2 && <VisaoNumerica num={painel.numericos} />}
    </div>
  );
}

function Controle({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="grid h-8 w-9 place-items-center rounded text-slate-500 hover:bg-slate-100">
      {children}
    </button>
  );
}

// ---------- Visao por colaborador / departamento ----------
function VisaoEntidades({
  itens,
  icone,
}: {
  itens: { id: string; nome: string; cor?: string; metricas: MetricasEntrega }[];
  icone: React.ReactNode;
}) {
  if (itens.length === 0) {
    return <p className="text-center text-slate-400">Nenhum dado para exibir.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {itens.map((it) => {
        const m = it.metricas;
        const segmentos: Segmento[] = [
          { valor: m.pendenteAntecipado.count, cor: COR.ok, label: 'Pendentes antecipado' },
          { valor: m.entregueNoPrazo.count, cor: COR.info, label: 'Entregues no prazo' },
          { valor: m.pendenteNoPrazo.count, cor: COR.infoClaro, label: 'Pendentes no prazo' },
          { valor: m.entregueComMulta.count, cor: COR.danger, label: 'Entregues com multa' },
        ];
        return (
          <div key={it.id} className="card overflow-hidden">
            <div className="border-b border-slate-100 py-3 text-center text-lg font-semibold text-status-ok">
              {it.nome}
            </div>
            <div className="grid place-items-center py-5">
              <Donut segmentos={segmentos} centro={icone} />
            </div>
            <div className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
              <LinhaMetrica cor={COR.ok} label="Pendentes antecipado" m={m.pendenteAntecipado} />
              <LinhaMetrica cor={COR.info} label="Entregues no prazo" m={m.entregueNoPrazo} />
              <LinhaMetrica cor={COR.infoClaro} label="Pendentes no prazo" m={m.pendenteNoPrazo} />
              <LinhaMetrica cor={COR.danger} label="Entregues com multa" m={m.entregueComMulta} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinhaMetrica({ cor, label, m }: { cor: string; label: string; m: Metrica }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span style={{ color: cor }}>{label}:</span>
      <span className="rounded-full px-3 py-0.5 text-sm font-semibold text-white" style={{ background: cor }}>
        {m.count}/{m.pct}%
      </span>
    </div>
  );
}

// ---------- Visao numerica ----------
function VisaoNumerica({ num }: { num: Painel['numericos'] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <CardNumero titulo="Entregas" valor={num.entregas.total} cor={COR.ok}>
        <LinhaMetrica cor={COR.info} label="Antecipadas" m={num.entregas.antecipadas} />
        <LinhaMetrica cor={COR.info} label="Prazo tecnico" m={num.entregas.prazoTecnico} />
        <LinhaMetrica cor={COR.danger} label="Atrasadas" m={num.entregas.atrasadas} />
        <LinhaMetrica cor={COR.warn} label="Atraso justificado" m={num.entregas.atrasoJustificado} />
      </CardNumero>

      <CardNumero titulo="A realizar" valor={num.aRealizar.total} cor={COR.warn}>
        <LinhaMetrica cor={COR.info} label="Prazo antecipado" m={num.aRealizar.prazoAntecipado} />
        <LinhaMetrica cor={COR.warn} label="Prazo tecnico" m={num.aRealizar.prazoTecnico} />
        <LinhaMetrica cor={COR.danger} label="Atraso legal" m={num.aRealizar.atrasoLegal} />
      </CardNumero>

      <CardNumero titulo="Docs" valor={num.docs.total} cor={COR.info}>
        <LinhaMetrica cor={COR.info} label="Lidos" m={num.docs.lidos} />
        <LinhaMetrica cor={COR.danger} label="Nao lidos" m={num.docs.naoLidos} />
      </CardNumero>

      <CardNumero titulo="Processos" valor={num.processos.total} cor={COR.info}>
        <LinhaMetrica cor={COR.info} label="Iniciados" m={num.processos.iniciados} />
        <LinhaMetrica cor={COR.info} label="Concluidos" m={num.processos.concluidos} />
        <LinhaMetrica cor={COR.info} label="Passos OK" m={num.processos.passosOk} />
      </CardNumero>

      <CardNumero titulo="Solicitacoes" valor={num.solicitacoes.total} cor={COR.info}>
        <LinhaSimples label="Abertas" valor={num.solicitacoes.abertas} />
        <LinhaSimples label="Finalizadas" valor={num.solicitacoes.finalizadas} />
        <LinhaSimples label="Resolvendo" valor={num.solicitacoes.resolvendo} />
      </CardNumero>
    </div>
  );
}

function CardNumero({ titulo, valor, cor, children }: { titulo: string; valor: number; cor: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="py-6 text-center">
        <div className="text-lg font-medium" style={{ color: cor }}>{titulo}</div>
        <div className="text-5xl font-bold" style={{ color: cor }}>{valor}</div>
      </div>
      <div className="divide-y divide-slate-100 border-t border-slate-100 text-sm">{children}</div>
    </div>
  );
}

function LinhaSimples({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-marca-600">{label}:</span>
      <span className="font-semibold text-slate-600">{valor}</span>
    </div>
  );
}
