import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  User,
  Building2,
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
  entregueComAtraso: Metrica;
  entregueComMulta: Metrica;
}
interface Painel {
  periodo: string;
  office?: string;
  usuario?: string;
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
  info: '#3b86c6',
  infoClaro: '#5dade2',
  danger: '#cf3c5d',
  warn: '#f0ad4e',
  roxo: '#9b59b6',
};

const VISOES = [
  'Insights por colaborador',
  'Insights por departamento',
  'Insights numericos',
] as const;

// semana atual (domingo..sabado) em YYYY-MM-DD, p/ os links do [F2]
function semanaAtual(): { legalDe: string; legalAte: string } {
  const h = new Date();
  const ini = new Date(h); ini.setDate(h.getDate() - h.getDay());
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { legalDe: fmt(ini), legalAte: fmt(fim) };
}
function ontemISO(): string { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

// monta /entregas?... a partir de um objeto de parametros (+ semana)
function linkF2(params: Record<string, string>, comSemana = true): string {
  const qs = new URLSearchParams(comSemana ? { ...semanaAtual(), ...params } : params);
  return `/entregas?${qs}`;
}

// categorias do donut -> filtros do [F2]
type CatDonut = 'pendAntecipado' | 'pendNoPrazo' | 'entregueNoPrazo' | 'entregueAtraso' | 'entregueMulta';
function linkCategoria(kind: 'colaborador' | 'departamento', id: string, cat: CatDonut): string {
  const base: Record<string, string> = kind === 'colaborador' ? { resp: id } : { dep: id };
  const ent: Record<string, string> = kind === 'colaborador' ? { soEntreguesPeloResp: '1' } : {};
  const m: Record<CatDonut, Record<string, string>> = {
    pendAntecipado: { ...base, flags: 'pendentes', pendAntesTec: '1' },
    pendNoPrazo: { ...base, flags: 'pendentes', pendDentroTec: '1' },
    entregueNoPrazo: { ...base, ...ent, flags: 'entregues' },
    entregueAtraso: { ...base, ...ent, flags: 'justificadas', naoPassivelMulta: '1' },
    entregueMulta: { ...base, ...ent, flags: 'justificadas', pmulta: '1' },
  };
  return linkF2(m[cat]);
}

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

      {visao === 0 && <VisaoEntidades kind="colaborador" itens={painel.colaboradores.map((c) => ({ ...c, cor: undefined }))} icone={<User size={96} strokeWidth={1.5} />} />}
      {visao === 1 && <VisaoEntidades kind="departamento" itens={painel.departamentos} icone={<Building2 size={92} strokeWidth={1.5} />} />}
      {visao === 2 && <VisaoNumerica num={painel.numericos} />}

      {/* Rodape estilo Acessorias */}
      {(painel.usuario || painel.office) && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-sm text-marca-700">
          <span><span className="font-semibold">Usuario:</span> {painel.usuario ?? '-'}</span>
          <span><span className="font-semibold">Office:</span> {painel.office ?? '-'}</span>
        </div>
      )}
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
  kind,
}: {
  itens: { id: string; nome: string; cor?: string; metricas: MetricasEntrega }[];
  icone: React.ReactNode;
  kind: 'colaborador' | 'departamento';
}) {
  // ordem fiel ao Acessorias
  const cats = (m: MetricasEntrega): { cor: string; label: string; m: Metrica; cat: CatDonut }[] => [
    { cor: COR.ok, label: 'Pendentes antecipado', m: m.pendenteAntecipado, cat: 'pendAntecipado' },
    { cor: COR.infoClaro, label: 'Pendentes no prazo', m: m.pendenteNoPrazo, cat: 'pendNoPrazo' },
    { cor: COR.info, label: 'Entregues no prazo', m: m.entregueNoPrazo, cat: 'entregueNoPrazo' },
    { cor: COR.roxo, label: 'Entregues com atraso', m: m.entregueComAtraso, cat: 'entregueAtraso' },
    { cor: COR.danger, label: 'Entregues com multa', m: m.entregueComMulta, cat: 'entregueMulta' },
  ];
  // so entidades com algum dado
  const comDados = itens.filter((it) => cats(it.metricas).some((c) => c.m.count > 0));
  if (comDados.length === 0) {
    return <p className="text-center text-slate-400">Nenhum dado para exibir na semana atual.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {comDados.map((it) => {
        const linhas = cats(it.metricas);
        const segmentos: Segmento[] = linhas.map((c) => ({ valor: c.m.count, cor: c.cor, label: c.label }));
        const avatar = (
          <div className="grid place-items-center rounded-full bg-slate-200 text-slate-500" style={{ width: 124, height: 124 }}>{icone}</div>
        );
        return (
          <div key={it.id} className="card overflow-hidden">
            <div className="bg-slate-50">
              <div className="pb-1 pt-4 text-center text-xl font-semibold text-status-ok">{it.nome}</div>
              <div className="grid place-items-center pb-5 pt-2">
                <Donut segmentos={segmentos} centro={avatar} tamanho={170} espessura={20} />
              </div>
            </div>
            <div className="divide-y divide-slate-200 border-t border-slate-200 text-sm">
              {/* so linhas com valor > 0 (igual ao original) */}
              {linhas.filter((c) => c.m.count > 0).map((c) => (
                <LinhaMetrica key={c.label} cor={c.cor} label={c.label} m={c.m} compact to={linkCategoria(kind, it.id, c.cat)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinhaMetrica({ cor, label, m, sub, to, compact }: { cor: string; label: string; m: Metrica; sub?: boolean; to?: string; compact?: boolean }) {
  const nav = useNavigate();
  return (
    <div onClick={to ? () => nav(to) : undefined}
      className={`flex items-center justify-between ${compact ? 'py-2' : 'py-2.5'} pr-4 ${sub ? 'pl-8' : 'px-4'} ${to ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
      <span className={compact ? 'text-sm font-semibold' : ''} style={{ color: cor }}>{sub ? '↳ ' : ''}{label}:</span>
      <span className={`rounded-full text-white ${compact ? 'px-2.5 py-1 text-[15px] font-normal leading-none' : 'px-3.5 py-0.5 text-lg font-semibold'}`} style={{ background: cor }}>
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
        <LinhaMetrica cor={COR.info} label="Antecipadas" m={num.entregas.antecipadas} to={linkF2({ flags: 'entregues', entAntecipada: '1' })} />
        <LinhaMetrica cor={COR.info} label="Prazo tecnico" m={num.entregas.prazoTecnico} to={linkF2({ flags: 'entregues', entNoPrazoTec: '1' })} />
        <LinhaMetrica cor={COR.danger} label="Atrasadas" m={num.entregas.atrasadas} to={linkF2({ flags: 'justificadas' })} />
        <LinhaMetrica cor={COR.danger} label="Com multa" m={num.entregas.comMulta} sub to={linkF2({ flags: 'justificadas', pmulta: '1' })} />
        <LinhaMetrica cor={COR.warn} label="Atraso justificado" m={num.entregas.atrasoJustificado} to={linkF2({ flags: 'justificadas' })} />
      </CardNumero>

      <CardNumero titulo="A realizar" valor={num.aRealizar.total} cor={COR.warn}>
        <LinhaMetrica cor={COR.info} label="Prazo antecipado" m={num.aRealizar.prazoAntecipado} to={linkF2({ flags: 'pendentes,justificadas', pendAntesTec: '1' })} />
        <LinhaMetrica cor={COR.warn} label="Prazo tecnico" m={num.aRealizar.prazoTecnico} to={linkF2({ flags: 'pendentes,justificadas', pendDentroTec: '1' })} />
        <LinhaMetrica cor={COR.danger} label="Atraso legal" m={num.aRealizar.atrasoLegal} to={linkF2({ flags: 'pendentes,justificadas', legalAte: ontemISO() }, false)} />
        <LinhaMetrica cor={COR.danger} label="Com multa" m={num.aRealizar.comMulta} sub to={linkF2({ flags: 'pendentes,justificadas', legalAte: ontemISO(), pmulta: '1' }, false)} />
        <LinhaMetrica cor={COR.warn} label="Atraso justificado" m={num.aRealizar.atrasoJustificado} to={linkF2({ flags: 'justificadas' })} />
      </CardNumero>

      <CardNumero titulo="Docs" valor={num.docs.total} cor={COR.info}>
        <LinhaMetrica cor={COR.info} label="Lidos" m={num.docs.lidos} />
        <LinhaMetrica cor={COR.danger} label="Nao lidos" m={num.docs.naoLidos} />
      </CardNumero>

      <CardNumero titulo="Processos" valor={num.processos.total} cor={COR.info}>
        <LinhaMetrica cor={COR.info} label="Iniciados" m={num.processos.iniciados} to="/processos" />
        <LinhaMetrica cor={COR.info} label="Concluidos" m={num.processos.concluidos} to="/processos" />
        <LinhaMetrica cor={COR.info} label="Passos OK" m={num.processos.passosOk} />
        <LinhaMetrica cor={COR.info} label="Follow-up enviados" m={num.processos.followups} />
      </CardNumero>

      <CardNumero titulo="Solicitacoes" valor={num.solicitacoes.total} cor={COR.info}>
        <LinhaSimples label="Abertas" valor={num.solicitacoes.abertas} to="/solicitacoes" />
        <LinhaSimples label="Finalizadas" valor={num.solicitacoes.finalizadas} to="/solicitacoes" />
        <LinhaSimples label="Aguardando Retorno" valor={num.solicitacoes.aguardando} to="/solicitacoes" />
        <LinhaSimples label="Resolvendo" valor={num.solicitacoes.resolvendo} to="/solicitacoes" />
        <LinhaSimples label="Media de Avaliacoes" valor={num.solicitacoes.mediaAvaliacoes} to="/area-vip/avaliacoes" />
      </CardNumero>
    </div>
  );
}

function CardNumero({ titulo, valor, cor, children }: { titulo: string; valor: number; cor: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="py-8 text-center">
        <div className="text-2xl font-medium" style={{ color: cor }}>{titulo}</div>
        <div className="font-light leading-none" style={{ color: cor, fontSize: '5rem' }}>{valor}</div>
      </div>
      <div className="divide-y divide-slate-100 border-t border-slate-100 text-base">{children}</div>
    </div>
  );
}

function LinhaSimples({ label, valor, to }: { label: string; valor: number; to?: string }) {
  const nav = useNavigate();
  return (
    <div onClick={to ? () => nav(to) : undefined}
      className={`flex items-center justify-between px-4 py-2.5 ${to ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
      <span className="text-marca-600">{label}:</span>
      <span className="text-lg font-semibold text-slate-600">{valor}</span>
    </div>
  );
}
