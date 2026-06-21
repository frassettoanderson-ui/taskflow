import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, SlidersHorizontal, X, SearchX, CalendarDays, SquarePen,
  Printer, Search, XCircle, ThumbsUp, MessageSquare, Paperclip, Save, History,
} from 'lucide-react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { Entrega, StatusEntrega, Departamento, UsuarioBasico, GrupoEmpresa, EntregaEvento } from '../../lib/tipos';

interface Pagina { items: Entrega[]; total: number; totalPages: number; page: number }
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// flag -> grupo de status (stored)
const GRUPO_STATUS: Record<string, StatusEntrega[]> = {
  pendentes: ['PENDENTE', 'PENDENTE_ANTECIPADO', 'EM_ATRASO_TECNICO', 'EM_ATRASO_LEGAL'],
  justificadas: ['ENTREGUE_JUSTIFICADA'],
  entregues: ['ENTREGUE'],
  dispensadas: ['DISPENSADA'],
};

// rotulos dos chips de classificacao (cliques do Dashboard)
const CHIP_LABEL: Record<string, string> = {
  entAntecipada: 'Entregas antecipadas',
  entNoPrazoTec: 'Entregas no prazo tecnico',
  entAtrasada: 'Entregas atrasadas',
  pendAntesTec: 'Somente pendentes antes do prazo tecnico',
  pendDentroTec: 'Somente pendentes dentro do prazo tecnico',
  soEntreguesPeloResp: 'Somente as entregues pelo responsavel',
  naoPassivelMulta: 'Somente Nao Passiveis Multas',
};

// rotulo curto + cor do "Status Entrega"
const ROTULO: Record<StatusEntrega, string> = {
  PENDENTE_ANTECIPADO: 'Antecipado',
  PENDENTE: 'No prazo',
  EM_ATRASO_TECNICO: 'Prazo tecnico',
  EM_ATRASO_LEGAL: 'Atrasada!',
  ENTREGUE: 'Entregue',
  ENTREGUE_JUSTIFICADA: 'Entregue c/ multa',
  DISPENSADA: 'Dispensada',
};
const COR: Record<StatusEntrega, string> = {
  PENDENTE_ANTECIPADO: '#3a9d3a',
  PENDENTE: '#5b9bd5',
  EM_ATRASO_TECNICO: '#e08a1e',
  EM_ATRASO_LEGAL: '#cf3c5d',
  ENTREGUE: '#3a9d3a',
  ENTREGUE_JUSTIFICADA: '#cf3c5d',
  DISPENSADA: '#94a3b8',
};

function dataCurta(d: string | Date): string {
  const x = new Date(d);
  const dd = String(x.getUTCDate()).padStart(2, '0');
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(x.getUTCFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

const mesAtual = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; };

const INP = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const DATA_INP = 'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-center text-[12px] text-slate-600 outline-none focus:border-marca-400';

export default function ListaEntregas() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeBaixar = temPermissao(sessao, 'entregas_baixar');
  const podeDispensar = temPermissao(sessao, 'entregas_dispensar');
  const podeMassa = temPermissao(sessao, 'entregas_acoes_massa');

  // ---- filtros (rascunho; aplicados ao clicar Filtrar) ----
  const [q, setQ] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [departamentoId, setDepartamentoId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [obrigacaoId, setObrigacaoId] = useState('');
  const [passivelMulta, setPassivelMulta] = useState(false);
  const [comAnexos, setComAnexos] = useState(false);
  // chips de classificacao vindos do Dashboard (filtros forcados removiveis)
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [flags, setFlags] = useState({ pendentes: true, justificadas: true, entregues: false, dispensadas: false });
  const [mostrarDatas, setMostrarDatas] = useState(false);
  const [mostrarImprimir, setMostrarImprimir] = useState(false);
  const [d, setD] = useState({
    compDe: mesAtual(), compAte: mesAtual(),
    prazoTecDe: '', prazoTecAte: '', prazoLegalDe: '', prazoLegalAte: '', entregaDe: '', entregaAte: '',
  });

  // ---- ordenacao + paginacao ----
  const [ordem, setOrdem] = useState<'obrigacao' | 'empresa' | 'prazoTecnico' | 'prazoLegal' | 'competencia'>('prazoLegal');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0); // incrementa ao clicar Filtrar

  // ---- dados ----
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [loading, setLoading] = useState(true);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [obrigacoes, setObrigacoes] = useState<{ id: string; nome: string }[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);

  // ---- selecao em massa ([F2] acoes em lote) ----
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [massaAcao, setMassaAcao] = useState<'transferir' | 'postergar' | 'baixar' | 'dispensar'>('transferir');
  const [massaResp, setMassaResp] = useState('');
  const [massaDias, setMassaDias] = useState('');
  const [massaData, setMassaData] = useState('');
  const [massaMotivo, setMassaMotivo] = useState('');
  const [massaExec, setMassaExec] = useState(false);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
    api.get<{ id: string; nome: string }[]>('/obrigacoes').then((o) => setObrigacoes(o.map((x) => ({ id: x.id, nome: x.nome })))).catch(() => undefined);
  }, []);

  // ---- aplica filtros vindos do Dashboard (?flags=...&resp=...&entAtrasada=1...) ----
  useEffect(() => {
    const p = searchParams;
    if ([...p.keys()].length === 0) return;
    if (p.get('flags')) {
      const s = new Set(p.get('flags')!.split(','));
      setFlags({ pendentes: s.has('pendentes'), justificadas: s.has('justificadas'), entregues: s.has('entregues'), dispensadas: s.has('dispensadas') });
    }
    if (p.get('resp')) setResponsavelId(p.get('resp')!);
    if (p.get('dep')) setDepartamentoId(p.get('dep')!);
    if (p.get('pmulta') === '1') setPassivelMulta(true);
    const legalDe = p.get('legalDe'); const legalAte = p.get('legalAte');
    setD((cur) => ({
      ...cur,
      compDe: legalDe || legalAte ? '' : cur.compDe,
      compAte: legalDe || legalAte ? '' : cur.compAte,
      prazoLegalDe: legalDe ?? cur.prazoLegalDe,
      prazoLegalAte: legalAte ?? cur.prazoLegalAte,
    }));
    const ch: Record<string, boolean> = {};
    for (const k of ['entAntecipada', 'entNoPrazoTec', 'entAtrasada', 'pendAntesTec', 'pendDentroTec', 'soEntreguesPeloResp', 'naoPassivelMulta']) {
      if (p.get(k) === '1') ch[k] = true;
    }
    setChips(ch);
    if (legalDe || legalAte) setMostrarDatas(true);
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function carregar() {
    setLoading(true);
    const statusList = Object.entries(flags).filter(([, v]) => v).flatMap(([k]) => GRUPO_STATUS[k]);
    const qs = new URLSearchParams({ page: String(page), limit: '50', ordem, dir });
    if (q.trim()) qs.set('q', q.trim());
    if (departamentoId) qs.set('departamentoId', departamentoId);
    if (responsavelId) qs.set('responsavelId', responsavelId);
    if (grupoId) qs.set('grupoId', grupoId);
    if (obrigacaoId) qs.set('obrigacaoId', obrigacaoId);
    if (passivelMulta) qs.set('passivelMulta', 'true');
    if (comAnexos) qs.set('comAnexos', 'true');
    // chips de classificacao (vindos do Dashboard)
    for (const k of Object.keys(chips)) if (chips[k]) qs.set(k === 'naoPassivelMulta' ? 'naoPassivelMulta' : k, 'true');
    if (statusList.length) qs.set('statusList', statusList.join(','));
    if (d.compDe) qs.set('compDe', d.compDe);
    if (d.compAte) qs.set('compAte', d.compAte);
    for (const k of ['prazoTecDe', 'prazoTecAte', 'prazoLegalDe', 'prazoLegalAte', 'entregaDe', 'entregaAte'] as const) {
      if (d[k]) qs.set(k, d[k]);
    }
    api.get<Pagina>(`/entregas?${qs}`).then(setPagina)
      .catch((e) => toast('erro', e instanceof ApiError ? e.message : 'Erro')).finally(() => setLoading(false));
  }
  useEffect(carregar, [tick, page, ordem, dir]);

  function filtrar() { setExpandida(null); setSel(new Set()); page === 1 ? setTick((t) => t + 1) : setPage(1); }

  const items = pagina?.items ?? [];
  const nomeUsuario = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);
  const todasMarcadas = items.length > 0 && items.every((e) => sel.has(e.id));
  const ncols = podeMassa ? 6 : 5;

  function toggleSel(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTodas() {
    setSel((s) => (items.every((e) => s.has(e.id)) ? new Set() : new Set(items.map((e) => e.id))));
  }

  async function executarMassa() {
    if (sel.size === 0) return;
    const payload: Record<string, unknown> = { entregaIds: [...sel], acao: massaAcao };
    if (massaAcao === 'transferir') {
      if (!massaResp) { toast('erro', 'Escolha o responsavel.'); return; }
      payload.responsavelId = massaResp;
    } else if (massaAcao === 'postergar') {
      if (massaData) payload.novaData = massaData;
      else if (massaDias) payload.dias = Number(massaDias);
      else { toast('erro', 'Informe os dias ou a nova data.'); return; }
    } else if (massaAcao === 'dispensar') {
      payload.motivo = massaMotivo || undefined;
    }
    const verbo = { transferir: 'transferir o responsavel de', postergar: 'alterar o prazo de', baixar: 'dar baixa em', dispensar: 'dispensar' }[massaAcao];
    if (!window.confirm(`Confirma ${verbo} ${sel.size} demanda(s)?`)) return;
    setMassaExec(true);
    try {
      const r = await api.post<{ afetadas: number }>('/entregas/acoes-massa', payload);
      toast('ok', `${r.afetadas} demanda(s) atualizada(s).`);
      setSel(new Set()); setMassaResp(''); setMassaDias(''); setMassaData(''); setMassaMotivo('');
      carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setMassaExec(false); }
  }

  function ordenar(o: typeof ordem) {
    if (ordem === o) { setDir((x) => (x === 'asc' ? 'desc' : 'asc')); }
    else { setOrdem(o); setDir('asc'); }
  }
  const seta = (o: typeof ordem) => (ordem === o ? (dir === 'asc' ? ' ↓' : ' ↑') : '');

  async function dispensar(e: Entrega) {
    const motivo = prompt('Motivo da dispensa da entrega:');
    if (motivo === null) return;
    try { await api.post(`/entregas/${e.id}/dispensar`, { motivo }); toast('ok', 'Entrega dispensada.'); carregar(); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro'); }
  }
  async function entregaRapida(e: Entrega) {
    try {
      const fd = new FormData();
      fd.append('dataEntrega', new Date().toISOString().slice(0, 10));
      fd.append('atualizarResponsavel', 'true');
      await api.upload(`/entregas/${e.id}/baixar`, fd);
      toast('ok', 'Entrega rapida registrada.'); carregar();
    } catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro'); }
  }
  function imprimir() {
    const qs = new URLSearchParams();
    if (d.compDe) qs.set('ano', d.compDe.split('-')[0]);
    if (d.compDe) qs.set('mes', String(Number(d.compDe.split('-')[1])));
    fetch(`/api/v1/entregas/export?${qs}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } })
      .then((r) => r.blob()).then((b) => {
        const url = URL.createObjectURL(b); const a = document.createElement('a');
        a.href = url; a.download = 'obrigacoes.csv'; a.click(); URL.revokeObjectURL(url);
      });
  }

  const Flag = ({ k, label, cor }: { k: keyof typeof flags; label: string; cor: string }) => (
    <label className="flex cursor-pointer select-none items-center gap-1.5 rounded px-1.5 py-1" style={{ background: cor }}>
      <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))} className="accent-marca-600" />
      <span className="text-[12px] font-medium text-slate-700">{label}</span>
    </label>
  );
  const IconBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button title={title} onClick={onClick} className="grid h-8 w-8 place-items-center rounded text-marca-600 hover:bg-marca-50">{children}</button>
  );

  return (
    <div className="-m-6 min-h-full bg-neutral-100 p-4 text-[13px]">
      {/* cabecalho */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <CheckCircle2 size={16} className="text-slate-400" />
          <span className="font-medium text-slate-700">Gestao das Obrigacoes e Tarefas</span>
          <span className="text-slate-400">[F2]</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* barra de filtros */}
      <div className="rounded border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${INP} w-56`} placeholder="Filtrar por Empresa" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && filtrar()} />
          <button onClick={() => setMostrarFiltros((v) => !v)}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-[12px] font-medium text-white ${mostrarFiltros ? 'bg-status-danger hover:bg-red-600' : 'bg-marca-400 hover:bg-marca-500'}`}>
            {mostrarFiltros ? <X size={14} /> : <SlidersHorizontal size={14} />} {mostrarFiltros ? 'Filtros' : '+Filtros'}
          </button>

          <div className="flex items-center gap-1">
            <Flag k="pendentes" label="Pendentes" cor="#fff3cd" />
            <Flag k="justificadas" label="Justificadas" cor="#e7f1ff" />
            <Flag k="entregues" label="Entregues" cor="#e8f6ec" />
            <Flag k="dispensadas" label="Dispensadas" cor="#eef0f2" />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <IconBtn title="Exibir filtros removedores" onClick={() => toast('erro', 'Em construcao')}><SearchX size={17} /></IconBtn>
            <IconBtn title="Exibir/ocultar datas" onClick={() => setMostrarDatas((v) => !v)}><CalendarDays size={17} /></IconBtn>
            <IconBtn title="Protocolo fisico" onClick={() => navigate('/documentos/protocolos-fisicos')}><SquarePen size={17} /></IconBtn>
            <IconBtn title="Imprimir" onClick={() => setMostrarImprimir((v) => !v)}><Printer size={17} /></IconBtn>
            <button onClick={filtrar} className="ml-1 flex items-center gap-2 rounded bg-status-ok px-4 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-600">
              <Search size={14} /> Filtrar
            </button>
          </div>
        </div>

        {/* Imprimir: opcoes de exportacao */}
        {mostrarImprimir && (
          <div className="mt-2 grid grid-cols-1 gap-1.5 border-t border-slate-100 pt-2 md:grid-cols-5">
            <BotaoExport cor="bg-status-ok hover:bg-emerald-600" onClick={() => toast('erro', 'Em construcao')}>
              Planejamento Semanal <span className="font-normal opacity-90">(do seu usuario)</span>
            </BotaoExport>
            <BotaoExport cor="bg-pink-600 hover:bg-pink-700" onClick={() => toast('erro', 'Em construcao')}>PDF relacao</BotaoExport>
            <BotaoExport cor="bg-sky-500 hover:bg-sky-600" onClick={() => toast('erro', 'Em construcao')}>PDF relacao com comentarios</BotaoExport>
            <BotaoExport cor="bg-purple-500 hover:bg-purple-600" onClick={() => toast('erro', 'Em construcao')}>PDF grade</BotaoExport>
            <BotaoExport cor="bg-amber-400 hover:bg-amber-500" onClick={imprimir}>Excel completo</BotaoExport>
          </div>
        )}

        {/* +Filtros: chip por departamento + grupo/obrigacao/multa/anexos */}
        {mostrarFiltros && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Filtrar por departamento</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip ativo={departamentoId === ''} onClick={() => setDepartamentoId('')}>Todos</Chip>
              {departamentos.map((dp) => (
                <Chip key={dp.id} ativo={departamentoId === dp.id} cor={dp.cor} onClick={() => setDepartamentoId(dp.id)}>
                  Dpto: {dp.nome}
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-0.5 text-[11px] uppercase text-slate-400">Grupo de empresas</div>
                <select className={`${INP} w-48`} value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                  <option value="">Todos</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-0.5 text-[11px] uppercase text-slate-400">Obrigacao especifica</div>
                <select className={`${INP} w-56`} value={obrigacaoId} onChange={(e) => setObrigacaoId(e.target.value)}>
                  <option value="">Todas</option>
                  {obrigacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-[12px] text-slate-600">
                <input type="checkbox" checked={passivelMulta} onChange={(e) => setPassivelMulta(e.target.checked)} className="accent-marca-600" /> Passiveis de multa
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-[12px] text-slate-600">
                <input type="checkbox" checked={comAnexos} onChange={(e) => setComAnexos(e.target.checked)} className="accent-marca-600" /> Com anexos/documentos
              </label>
            </div>
          </div>
        )}

        {/* linha de datas */}
        {mostrarDatas && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2 md:grid-cols-4 lg:grid-cols-8">
            <Mes label="Competencia de" value={d.compDe} onChange={(v) => setD((s) => ({ ...s, compDe: v }))} />
            <Mes label="Competencia ate" value={d.compAte} onChange={(v) => setD((s) => ({ ...s, compAte: v }))} />
            <Dia label="Prazo tec. de" value={d.prazoTecDe} onChange={(v) => setD((s) => ({ ...s, prazoTecDe: v }))} />
            <Dia label="Prazo tec. ate" value={d.prazoTecAte} onChange={(v) => setD((s) => ({ ...s, prazoTecAte: v }))} />
            <Dia label="Prazo legal de" value={d.prazoLegalDe} onChange={(v) => setD((s) => ({ ...s, prazoLegalDe: v }))} />
            <Dia label="Prazo legal ate" value={d.prazoLegalAte} onChange={(v) => setD((s) => ({ ...s, prazoLegalAte: v }))} />
            <Dia label="Entrega do dia" value={d.entregaDe} onChange={(v) => setD((s) => ({ ...s, entregaDe: v }))} />
            <Dia label="Entrega ate dia" value={d.entregaAte} onChange={(v) => setD((s) => ({ ...s, entregaAte: v }))} />
          </div>
        )}
      </div>

      {/* chips de filtros forcados (vindos do Dashboard) */}
      {(responsavelId || Object.values(chips).some(Boolean)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {responsavelId && (
            <ChipFiltro label={`Resp: ${nomeUsuario.get(responsavelId) ?? '...'}`} onRemove={() => { setResponsavelId(''); filtrar(); }} />
          )}
          {Object.entries(chips).filter(([, v]) => v).map(([k]) => (
            <ChipFiltro key={k} label={CHIP_LABEL[k] ?? k} onRemove={() => { setChips((c) => ({ ...c, [k]: false })); filtrar(); }} />
          ))}
        </div>
      )}

      {/* barra de acoes em massa */}
      {podeMassa && sel.size > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-marca-200 bg-marca-50 p-2 text-[12px]">
          <span className="font-semibold text-marca-700">{sel.size} selecionada(s):</span>
          <select className={INP} value={massaAcao} onChange={(e) => setMassaAcao(e.target.value as never)}>
            <option value="transferir">Transferir responsavel</option>
            <option value="postergar">Alterar prazo</option>
            {podeBaixar && <option value="baixar">Dar baixa</option>}
            {podeDispensar && <option value="dispensar">Dispensar</option>}
          </select>
          {massaAcao === 'transferir' && (
            <select className={`${INP} w-48`} value={massaResp} onChange={(e) => setMassaResp(e.target.value)}>
              <option value="">Escolher responsavel...</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
          {massaAcao === 'postergar' && (
            <>
              <input className={`${INP} w-24`} type="number" placeholder="+ dias" value={massaDias}
                onChange={(e) => { setMassaDias(e.target.value); if (e.target.value) setMassaData(''); }} />
              <span className="text-slate-400">ou</span>
              <input className={INP} type="date" value={massaData}
                onChange={(e) => { setMassaData(e.target.value); if (e.target.value) setMassaDias(''); }} />
            </>
          )}
          {massaAcao === 'dispensar' && (
            <input className={`${INP} w-56`} placeholder="Motivo (opcional)" value={massaMotivo} onChange={(e) => setMassaMotivo(e.target.value)} />
          )}
          <button onClick={executarMassa} disabled={massaExec}
            className="ml-auto rounded bg-status-ok px-4 py-1.5 font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
            {massaExec ? '...' : 'Aplicar'}
          </button>
          <button onClick={() => setSel(new Set())} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50">Limpar</button>
        </div>
      )}

      {/* tabela */}
      <div className="mt-2 overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-white text-left align-top text-[12px] text-slate-500">
              {podeMassa && (
                <th className="w-8 px-2 py-2 align-middle">
                  <input type="checkbox" checked={todasMarcadas} onChange={toggleTodas} className="accent-marca-600" title="Selecionar todas" />
                </th>
              )}
              <th className="px-3 py-2 font-normal">
                <button onClick={() => ordenar('obrigacao')} className="font-semibold text-marca-600 hover:underline">Obrigacao{seta('obrigacao')}</button>
                <span className="text-slate-400"> / Tarefa</span>
                <div className="mt-0.5">
                  <button onClick={() => ordenar('empresa')} className="text-marca-600 hover:underline">Empresa{seta('empresa')}</button>
                  <span className="text-slate-400"> [ID | Final CNPJ]</span>
                </div>
              </th>
              <th className="px-3 py-2 font-normal">
                <button onClick={() => ordenar('prazoTecnico')} className="font-semibold text-marca-600 hover:underline">Prazo{seta('prazoTecnico')}</button>
                <span className="text-slate-400"> &rarr; Status Entrega</span>
                <div className="mt-0.5 text-slate-400">Dpto - Resp. [Prazo/Entrega]</div>
              </th>
              <th className="px-3 py-2 font-normal">
                <button onClick={() => ordenar('prazoLegal')} className="font-semibold text-marca-600 hover:underline">Prazo legal{seta('prazoLegal')}</button>
                <div className="mt-0.5">
                  <button onClick={() => ordenar('competencia')} className="text-marca-600 hover:underline">Competencia{seta('competencia')}</button>
                </div>
              </th>
              <th className="px-3 py-2 font-normal">
                <div className="font-semibold text-slate-600">Protocolo de entrega</div>
                <div className="mt-0.5 text-slate-400">Comentarios</div>
              </th>
              <th className="px-3 py-2 text-right font-normal align-middle">
                <span className="text-marca-600">&laquo; {pagina?.total ?? 0} reg &raquo;</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={ncols} className="py-12"><Spinner /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={ncols} className="px-3 py-12 text-center text-slate-400">Nenhuma obrigacao/tarefa para os filtros selecionados.</td></tr>
            ) : items.map((e) => {
              const cor = e.obrigacao.departamento?.cor ?? '#64748b';
              const respId = e.responsavelEntregaId ?? e.responsavelPrazoId;
              const resp = respId ? nomeUsuario.get(respId) ?? '-' : '-';
              const aberta = expandida === e.id;
              return (
                <Fragment key={e.id}>
                  <tr onClick={() => setExpandida(aberta ? null : e.id)}
                    className={`cursor-pointer border-b border-slate-100 align-top hover:bg-slate-50 ${aberta ? 'bg-slate-50' : ''} ${sel.has(e.id) ? 'bg-marca-50' : ''}`}>
                    {podeMassa && (
                      <td className="px-2 py-2 align-middle" onClick={(ev) => ev.stopPropagation()}>
                        <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggleSel(e.id)} className="accent-marca-600" />
                      </td>
                    )}
                    {/* col 1 */}
                    <td className="px-3 py-2">
                      <div className="font-semibold" style={{ color: cor }}>{e.obrigacao.nome}</div>
                      <div className="text-slate-600">
                        {e.empresa.razaoSocial}
                        <span className="text-slate-400"> [{e.empresa.numero ?? '-'} | {e.empresa.cnpjFinal ?? '----'}]</span>
                      </div>
                    </td>
                    {/* col 2 */}
                    <td className="px-3 py-2">
                      <span className="inline-block rounded px-1.5 py-0.5 text-[12px] font-medium" style={{ background: COR[e.status] + '22', color: COR[e.status] }}>
                        {dataCurta(e.prazoTecnico)} {ROTULO[e.status]}
                      </span>
                      <div className="mt-0.5 text-slate-500">
                        {e.obrigacao.departamento?.nome ?? '-'} - {resp}
                      </div>
                    </td>
                    {/* col 3 */}
                    <td className="px-3 py-2">
                      <div className="text-slate-600">{dataCurta(e.prazoLegal)}</div>
                      <div className="mt-0.5 font-medium text-marca-700">{MESES[e.competenciaMes - 1]}/{e.competenciaAno}</div>
                    </td>
                    {/* col 4 */}
                    <td className="px-3 py-2">
                      <div className="text-slate-600">{e.numeroProtocolo || <span className="text-slate-300">-</span>}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-slate-400">
                        {e.qtdEventos ?? 0} <MessageSquare size={13} />
                      </div>
                    </td>
                    {/* col 5 */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {podeDispensar && (
                          <button title="Dispensar entrega" onClick={(ev) => { ev.stopPropagation(); dispensar(e); }} className="text-status-danger hover:opacity-70"><XCircle size={20} /></button>
                        )}
                        {podeBaixar && (
                          <button title="Entrega rapida" onClick={(ev) => { ev.stopPropagation(); entregaRapida(e); }} className="text-status-ok hover:opacity-70"><ThumbsUp size={20} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {aberta && (
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td colSpan={ncols} className="px-3 py-3">
                        <LinhaBaixa entrega={e} nomeUsuario={nomeUsuario} onBaixado={() => { setExpandida(null); carregar(); }} onDispensar={() => dispensar(e)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* paginacao */}
      {pagina && pagina.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-[12px]">
          <button className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span className="text-slate-500">Pagina {pagina.page} de {pagina.totalPages} ({pagina.total})</span>
          <button className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40" disabled={page >= pagina.totalPages} onClick={() => setPage((p) => p + 1)}>Proxima</button>
        </div>
      )}

      <div className="mt-3 text-center text-[11px] text-slate-400">
        <Link to="/entregas/calendario" className="text-marca-600 hover:underline">Ver calendario</Link>
      </div>
    </div>
  );
}

function ChipFiltro({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-600">
      <button onClick={onRemove} className="text-slate-400 hover:text-red-500">×</button>
      {label}
    </span>
  );
}

function BotaoExport({ cor, onClick, children }: { cor: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-[13px] font-medium text-white ${cor}`}>
      <Printer size={15} /> {children}
    </button>
  );
}

function Chip({ ativo, cor, onClick, children }: { ativo: boolean; cor?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${ativo ? 'border-marca-400 bg-marca-50 text-marca-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
      {cor && <span className="h-2 w-2 rounded-full" style={{ background: cor }} />}
      {children}
    </button>
  );
}

function Mes({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><div className="mb-0.5 text-[10px] uppercase text-slate-400">{label}</div>
    <input type="month" className={DATA_INP} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function Dia({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><div className="mb-0.5 text-[10px] uppercase text-slate-400">{label}</div>
    <input type="date" className={DATA_INP} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

// ---------- Linha expandida: baixa / dispensa ----------
function LinhaBaixa({ entrega, nomeUsuario, onBaixado, onDispensar }: { entrega: Entrega; nomeUsuario: Map<string, string>; onBaixado: () => void; onDispensar: () => void }) {
  const toast = useToast();
  const [eventos, setEventos] = useState<EntregaEvento[] | null>(null);
  const [protocolo, setProtocolo] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviarEmail, setEnviarEmail] = useState<'nao' | 'imediato' | 'agendado' | 'preagendado'>('nao');
  const [vcto, setVcto] = useState('');
  const [obsEmail, setObsEmail] = useState('');
  const [comentario, setComentario] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<EntregaEvento[]>(`/entregas/${entrega.id}/eventos`).then(setEventos).catch(() => setEventos([]));
  }, [entrega.id]);

  async function salvar() {
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('dataEntrega', new Date().toISOString().slice(0, 10));
      fd.append('atualizarResponsavel', 'true');
      if (protocolo.trim()) fd.append('numeroProtocolo', protocolo.trim());
      if (vcto) fd.append('vencimentoGuia', vcto);
      if (justificativa.trim()) fd.append('justificativa', justificativa.trim());
      if (comentario.trim() || obsEmail.trim()) fd.append('comentario', [comentario.trim(), obsEmail.trim()].filter(Boolean).join(' | '));
      if (enviarEmail === 'imediato') fd.append('enviarCliente', 'true');
      if (arquivo) fd.append('anexos', arquivo);
      await api.upload(`/entregas/${entrega.id}/baixar`, fd);
      toast('ok', enviarEmail === 'agendado' || enviarEmail === 'preagendado' ? 'Baixado. (envio agendado: em construcao)' : 'Entrega registrada.');
      onBaixado();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.4fr_1.2fr_1fr_0.8fr]">
        <div>
          <label className="mb-0.5 block text-[11px] text-slate-500">Numero do protocolo de entrega</label>
          <input className={`${INP} w-full`} placeholder="Informe para marcar como 'Entregue'" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-slate-500">Anexar arquivo</label>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1.5">
            <span className="rounded bg-marca-500 px-2 py-0.5 text-[11px] font-medium text-white">Escolher</span>
            <span className="flex items-center gap-1 truncate text-[12px] text-slate-500"><Paperclip size={12} />{arquivo ? arquivo.name : 'Anexo [ate 60MB]'}</span>
            <input type="file" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-slate-500">Enviar por email?</label>
          <select className={`${INP} w-full`} value={enviarEmail} onChange={(e) => setEnviarEmail(e.target.value as never)}>
            <option value="nao">Nao</option>
            <option value="imediato">Sim - Imediato</option>
            <option value="agendado">Sim - Agendado</option>
            <option value="preagendado">Sim - Pre-agendado</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-slate-500">Vcto (caso seja guia)</label>
          <input type="date" className={`${INP} w-full`} value={vcto} onChange={(e) => setVcto(e.target.value)} />
        </div>
      </div>

      <input className={`${INP} w-full`} placeholder="Comentario / observacao para esse arquivo no e-mail (opcional)" value={obsEmail} onChange={(e) => setObsEmail(e.target.value)} />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_1fr]">
        <div className="flex flex-col gap-2">
          <button onClick={salvar} disabled={salvando} className="flex items-center justify-center gap-2 rounded bg-status-ok px-5 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
            <Save size={15} /> {salvando ? '...' : 'OK - Salvar'}
          </button>
          <button onClick={onDispensar} className="flex items-center justify-center gap-2 rounded bg-status-danger px-5 py-1.5 text-[13px] font-medium text-white hover:bg-red-600">
            <X size={15} /> Dispensar
          </button>
        </div>
        <input className={`${INP} w-full`} placeholder="Adicionar comentario..." value={comentario} onChange={(e) => setComentario(e.target.value)} />
        <input className={`${INP} w-full`} placeholder="Justificativa de atraso/dispensa" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
      </div>

      {/* Historico de movimentacao (balaozinho) */}
      {eventos && eventos.length > 0 && (
        <div className="mt-1 rounded border border-slate-200 bg-white p-2">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase text-slate-400"><History size={12} /> Historico de movimentacao</div>
          <ul className="space-y-1">
            {eventos.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                <span className="text-slate-400">{new Date(ev.createdAt).toLocaleString('pt-BR')}</span>
                <span className="text-slate-700">{ev.texto}</span>
                {ev.autorId && <span className="text-marca-500">({nomeUsuario.get(ev.autorId) ?? '—'})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
