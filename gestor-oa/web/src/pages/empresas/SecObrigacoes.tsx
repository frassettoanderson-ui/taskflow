import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, List, Printer, Plus, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, AlertTriangle, ArrowRight } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { Obrigacao } from '../../lib/tipos';

interface Contadores { verde: number; vermelho: number; amarelo: number; azul: number }
interface PainelObrig { id: string; obrigacaoId: string; nome: string; ativo: boolean; tempoPrevisto: number; contadores: Contadores }
interface PainelDep { id: string; nome: string; cor: string; contadores: Contadores; obrigacoes: PainelObrig[] }
interface Painel { departamentos: PainelDep[] }

type Cor = 'verde' | 'vermelho' | 'amarelo' | 'azul';
const INP = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400';

// datas (yyyy-mm-dd) p/ o deep-link do F2
const hojeUTC = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };
const addDias = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export default function SecObrigacoes({ empresaId, empresaNumero }: { empresaId: string; empresaNumero: number | null }) {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const pode = temPermissao(sessao, 'obrigacoes_gerenciar');

  const [painel, setPainel] = useState<Painel | null>(null);
  const [catalogo, setCatalogo] = useState<Obrigacao[]>([]);
  const [novaObrig, setNovaObrig] = useState('');
  const [exibirInativas, setExibirInativas] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  function carregar() { api.get<Painel>(`/empresa-obrigacoes/empresa/${empresaId}/painel`).then(setPainel).catch(() => setPainel({ departamentos: [] })); }
  useEffect(() => { carregar(); api.get<Obrigacao[]>('/obrigacoes').then(setCatalogo).catch(() => undefined); /* eslint-disable-next-line */ }, [empresaId]);

  async function adicionar() {
    if (!novaObrig) return;
    try { await api.post(`/empresa-obrigacoes/empresa/${empresaId}/manual`, { obrigacaoId: novaObrig }); setNovaObrig(''); toast('ok', 'Obrigacao adicionada.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function salvarOverride(eoId: string, dados: { tempoPrevistoOverride?: number; ativo?: boolean }) {
    try { await api.put(`/empresa-obrigacoes/vinculo/${eoId}/overrides`, dados); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  // deep-link p/ a Lista de Entregas (F2) com o filtro da cor
  function irParaF2(cor: Cor, alvo: { depId?: string; obrigacaoId?: string }) {
    const p = new URLSearchParams();
    if (empresaNumero != null) p.set('q', String(empresaNumero));
    if (alvo.obrigacaoId) p.set('obrigacaoId', alvo.obrigacaoId);
    else if (alvo.depId && alvo.depId !== 'sem') p.set('dep', alvo.depId);
    const hoje = hojeUTC();
    if (cor === 'verde') { p.set('flags', 'entregues'); p.set('entregaDe', fmt(addDias(hoje, -30))); }
    else {
      p.set('flags', 'pendentes,justificadas');
      if (cor === 'vermelho') p.set('prazoTecAte', fmt(addDias(hoje, -1)));
      else if (cor === 'amarelo') { p.set('prazoTecDe', fmt(hoje)); p.set('prazoTecAte', fmt(addDias(hoje, 30))); }
      else p.set('prazoTecDe', fmt(addDias(hoje, 31)));
    }
    navigate(`/entregas?${p.toString()}`);
  }

  function toggle(depId: string) { setAbertos((s) => { const n = new Set(s); n.has(depId) ? n.delete(depId) : n.add(depId); return n; }); }

  if (!painel) return <Spinner />;
  const disponiveis = catalogo;

  return (
    <div className="space-y-2">
      {/* 3 botoes do canto direito */}
      <div className="flex items-center justify-end gap-3 text-slate-400">
        <button title={exibirInativas ? 'Ocultar obrigacoes inativas' : 'Exibir obrigacoes inativas'} onClick={() => setExibirInativas((v) => !v)} className="hover:text-marca-600">{exibirInativas ? <Eye size={18} className="text-marca-600" /> : <EyeOff size={18} />}</button>
        <button title="Grupo de obrigacoes" onClick={() => navigate('/obrigacoes/grupos')} className="hover:text-marca-600"><List size={18} /></button>
        <button title="Emitir relatorios" onClick={() => toast('ok', 'Em construcao: relatorios de obrigacoes da empresa.')} className="hover:text-marca-600"><Printer size={18} /></button>
      </div>

      {/* Selecione + Adicionar */}
      {pode && (
        <div className="flex gap-2">
          <select className={`${INP} flex-1`} value={novaObrig} onChange={(e) => setNovaObrig(e.target.value)}>
            <option value="">Selecione...</option>
            {disponiveis.map((o) => <option key={o.id} value={o.id}>{o.nome}{o.departamento ? ` [${o.departamento.nome}]` : ''}</option>)}
          </select>
          <button onClick={adicionar} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={15} /> Adicionar</button>
        </div>
      )}

      {/* setores */}
      <div className="mt-1">
        {painel.departamentos.map((dep) => {
          const aberto = abertos.has(dep.id);
          const obrigs = exibirInativas ? dep.obrigacoes : dep.obrigacoes.filter((o) => o.ativo);
          return (
            <div key={dep.id} className="border-b border-slate-100">
              {/* cabecalho do setor */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5">
                <button onClick={() => toggle(dep.id)} className="flex items-center gap-1 text-left text-[13px] font-bold text-marca-600">
                  {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{dep.nome} <span className="font-normal text-marca-400">(clique para exibir/ocultar)</span>
                </button>
                <Barra c={dep.contadores} onClick={(cor) => irParaF2(cor, { depId: dep.id })} />
                <span />
              </div>
              {/* obrigacoes do setor */}
              {aberto && obrigs.map((o, idx) => (
                <div key={o.id} className={`grid grid-cols-[1fr_auto_170px_140px] items-center gap-3 px-2 py-1.5 ${idx % 2 ? 'bg-fundo' : 'bg-white'}`}>
                  <button onClick={() => navigate(`/obrigacoes/${o.obrigacaoId}`)} className={`text-left text-[13px] hover:underline ${o.ativo ? 'text-marca-600' : 'text-slate-400 line-through'}`}>{o.nome}</button>
                  <Barra c={o.contadores} onClick={(cor) => irParaF2(cor, { obrigacaoId: o.obrigacaoId })} />
                  <div>
                    <span className="mb-0.5 block text-center text-[11px] text-slate-400">Tempo previsto (min)</span>
                    <input className={`${INP} w-full text-center`} type="number" min={0} defaultValue={o.tempoPrevisto} disabled={!pode} onBlur={(e) => salvarOverride(o.id, { tempoPrevistoOverride: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                  </div>
                  <select className={INP} value={o.ativo ? 'sim' : 'nao'} disabled={!pode} onChange={(e) => { salvarOverride(o.id, { ativo: e.target.value === 'sim' }).then(carregar); }}>
                    <option value="sim">Ativa? Sim</option>
                    <option value="nao">Ativa? Nao</option>
                  </select>
                </div>
              ))}
            </div>
          );
        })}
        {painel.departamentos.length === 0 && <p className="py-2 text-[12px] text-slate-400">Nenhuma obrigacao vinculada. Aplique um regime/grupo ou adicione acima.</p>}
      </div>
    </div>
  );
}

// Barra de 4 cores/contadores
function Barra({ c, onClick }: { c: Contadores; onClick: (cor: Cor) => void }) {
  const seg = 'flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-white';
  return (
    <div className="flex overflow-hidden rounded">
      <button onClick={() => onClick('verde')} title="Entregues/resolvidos" className={`${seg} bg-status-ok hover:brightness-95`}>{c.verde} <ThumbsUp size={12} /></button>
      <button onClick={() => onClick('vermelho')} title="Atraso tecnico" className={`${seg} bg-status-danger hover:brightness-95`}>{c.vermelho} <ThumbsDown size={12} /></button>
      <button onClick={() => onClick('amarelo')} title="Proximos 30 dias" className={`${seg} bg-status-warn hover:brightness-95`}>{c.amarelo} <AlertTriangle size={12} /></button>
      <button onClick={() => onClick('azul')} title="Futuras (30 dias +)" className={`${seg} bg-marca-400 hover:brightness-95`}>{c.azul} <ArrowRight size={12} /></button>
    </div>
  );
}
