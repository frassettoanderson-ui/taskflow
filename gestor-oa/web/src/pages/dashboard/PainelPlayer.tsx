import { useEffect, useRef, useState } from 'react';
import { SkipBack, SkipForward, ChevronLeft, ChevronRight, Pause, Play, X, User, Network } from 'lucide-react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';
import type { PainelCalculado, IndicadorCalculado, IndicadorItem } from '../../lib/tipos';

const COR = { ok: '#5cb85c', info: '#5b9bd5', warn: '#f0ad4e', danger: '#cf3c5d', roxo: '#7e57c2' };

export default function PainelPlayer({ painelId, onSair }: { painelId: string; onSair: () => void }) {
  const [painel, setPainel] = useState<PainelCalculado | null>(null);
  const [idx, setIdx] = useState(0);
  const [tocando, setTocando] = useState(true);
  const [progresso, setProgresso] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPainel(null); setIdx(0);
    api.get<PainelCalculado>(`/dashboard/paineis/${painelId}/calculado`).then(setPainel).catch(() => onSair());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painelId]);

  const total = painel?.indicadores.length ?? 0;
  const transMs = (painel?.transicaoSeg ?? 60) * 1000;

  // auto-rotacao + barra de progresso
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    setProgresso(0);
    if (tocando && total > 1) {
      const passo = 100; const inc = (passo / transMs) * 100;
      timer.current = setInterval(() => {
        setProgresso((p) => {
          if (p + inc >= 100) { setIdx((i) => (i + 1) % total); return 0; }
          return p + inc;
        });
      }, passo);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [tocando, total, transMs, idx]);

  // atalhos: CTRL+Espaco play/pause, CTRL+setas, ESC sai
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onSair(); return; }
      if (!e.ctrlKey) return;
      if (e.code === 'Space') { e.preventDefault(); setTocando((t) => !t); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setIdx((i) => (i + 1) % total); setProgresso(0); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => (i - 1 + total) % total); setProgresso(0); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onSair]);

  if (!painel) return <Spinner />;
  if (total === 0) return (
    <div className="space-y-3 text-center">
      <p className="text-slate-400">Este painel nao tem indicadores ativos.</p>
      <button className="btn-ghost border border-slate-300" onClick={onSair}>Voltar</button>
    </div>
  );

  const ind = painel.indicadores[idx];
  const ir = (n: number) => { setIdx((n + total) % total); setProgresso(0); };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-marca-600">{painel.nome}</h1>
        <p className="text-sm font-medium text-status-danger">[{ind.nome}] - {idx + 1}/{total}</p>
      </div>

      {/* barra de progresso */}
      <div className="h-1 w-full overflow-hidden rounded bg-slate-200">
        <div className="h-full bg-marca-400 transition-[width] duration-100" style={{ width: `${progresso}%` }} />
      </div>

      {/* controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
          <Ctrl onClick={() => ir(0)} title="Primeira"><SkipBack size={16} /></Ctrl>
          <Ctrl onClick={() => ir(idx - 1)} title="Anterior (Ctrl+Esq)"><ChevronLeft size={16} /></Ctrl>
          <Ctrl onClick={() => setTocando((t) => !t)} title="Play/Pause (Ctrl+Espaco)">{tocando ? <Pause size={16} /> : <Play size={16} />}</Ctrl>
          <Ctrl onClick={() => ir(idx + 1)} title="Proxima (Ctrl+Dir)"><ChevronRight size={16} /></Ctrl>
          <Ctrl onClick={() => ir(total - 1)} title="Ultima"><SkipForward size={16} /></Ctrl>
        </div>
        <button className="flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" onClick={onSair}>
          <X size={14} /> Sair (Esc)
        </button>
      </div>

      {/* pontos */}
      <div className="flex flex-wrap justify-center gap-2">
        {painel.indicadores.map((_, i) => (
          <button key={i} onClick={() => ir(i)} className={`h-2 w-2 rounded-full transition ${i === idx ? 'bg-marca-500' : 'bg-slate-300'}`} />
        ))}
      </div>

      <IndicadorView ind={ind} />
    </div>
  );
}

function Ctrl({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} className="grid h-8 w-9 place-items-center rounded text-slate-500 hover:bg-slate-100">{children}</button>;
}

function IndicadorView({ ind }: { ind: IndicadorCalculado }) {
  if (ind.tipo === 'numerico') {
    return (
      <div className="mx-auto max-w-md">
        <div className="card overflow-hidden py-12 text-center">
          <div className="text-lg font-medium text-marca-600">{ind.nome}</div>
          <div className="text-7xl font-bold text-marca-700">{ind.valor ?? 0}</div>
        </div>
      </div>
    );
  }
  const itens = ind.itens ?? [];
  if (itens.length === 0) return <p className="text-center text-slate-400">Nenhum dado para exibir.</p>;
  const icone = ind.tipo === 'colaborador' ? <User size={40} /> : <Network size={40} />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {itens.map((it) => <CardEntidade key={it.id} it={it} icone={icone} />)}
    </div>
  );
}

function CardEntidade({ it, icone }: { it: IndicadorItem; icone: React.ReactNode }) {
  const total = it.baixadas + it.pendentes;
  const pctB = total ? Math.round((it.baixadas / total) * 100) : 0;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 p-3">
        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-400" style={it.cor ? { background: it.cor + '22', color: it.cor } : undefined}>
          {icone}
        </div>
        <div className="font-semibold text-status-ok">{it.nome}</div>
      </div>
      <div className="space-y-2 p-4">
        <Barra label="Entregues" valor={it.baixadas} pct={pctB} cor={COR.info} />
        <Barra label="Pendentes" valor={it.pendentes} pct={100 - pctB} cor={COR.warn} />
      </div>
    </div>
  );
}

function Barra({ label, valor, pct, cor }: { label: string; valor: number; pct: number; cor: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span style={{ color: cor }}>{label}</span><span className="font-semibold text-slate-600">{valor}</span></div>
      <div className="h-2 w-full overflow-hidden rounded bg-slate-100"><div className="h-full" style={{ width: `${pct}%`, background: cor }} /></div>
    </div>
  );
}
