import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2, Settings, Heart, Save, RotateCcw, Trash2, RotateCw,
  CheckSquare, Square, Ban, Lightbulb, ChevronDown, ChevronRight, Eye, EyeOff,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { ProcessoDetalhe, StatusProcesso, ProcessoPasso, Departamento, UsuarioBasico } from '../../lib/tipos';

const COR: Record<StatusProcesso, string> = {
  EM_ANDAMENTO: '#5b9bd5', CONCLUIDO: '#5cb85c', SUSPENSO: '#f0ad4e', CANCELADO: '#cf3c5d',
};

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-2 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 block text-[13px] font-semibold text-slate-700';

function dataBR(d?: string | null): string {
  if (!d) return '-';
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`;
}
function diasDesde(d: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 86400000));
}

export default function ProcessoFicha() {
  const { id = '' } = useParams();
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeOperar = temPermissao(sessao, 'processos_operar');

  const [p, setP] = useState<ProcessoDetalhe | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [ocultarDispensados, setOcultar] = useState(false);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  // edicao de cabecalho
  const [titulo, setTitulo] = useState('');
  const [gestorId, setGestorId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    api.get<ProcessoDetalhe>(`/processos/${id}`).then((d) => {
      setP(d); setTitulo(d.titulo ?? d.nome); setGestorId(d.gestorId ?? ''); setObservacoes(d.observacoes ?? '');
    });
  }
  useEffect(carregar, [id]);
  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
  }, []);

  const nomeDepto = useMemo(() => new Map(departamentos.map((x) => [x.id, x.nome])), [departamentos]);

  async function acao(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); toast('ok', msg); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function salvarCabecalho() {
    setSalvando(true);
    try { await api.put(`/processos/${id}`, { titulo, gestorId: gestorId || null, observacoes }); toast('ok', 'Processo salvo.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  if (!p) return <Spinner />;

  const dep = p.departamentoId ? nomeDepto.get(p.departamentoId) : null;
  const total = p.passos.length;
  const feitos = p.passos.filter((x) => x.status !== 'PENDENTE').length;
  const progresso = total ? Math.round((feitos / total) * 1000) / 10 : 0;

  // agrupa passos por departamento (secoes)
  const grupos: { chave: string; nome: string; passos: ProcessoPasso[] }[] = [];
  for (const passo of p.passos) {
    const chave = passo.departamentoId ?? 'geral';
    const nome = passo.departamentoId ? nomeDepto.get(passo.departamentoId) ?? 'Departamento' : 'Geral';
    let g = grupos.find((x) => x.chave === chave);
    if (!g) { g = { chave, nome, passos: [] }; grupos.push(g); }
    g.passos.push(passo);
  }

  const statusTxt =
    p.status === 'CANCELADO' ? `Desistencia em ${dataBR(p.dataConclusao)}`
    : p.status === 'CONCLUIDO' ? `Concluido em ${dataBR(p.dataConclusao)}`
    : p.status === 'SUSPENSO' ? `Suspenso ate ${dataBR(p.suspensoAte)}`
    : 'Em andamento';

  return (
    <div className="-m-6 min-h-full bg-neutral-100 p-5 text-[13px]">
      <div className="mb-4 flex items-center gap-2 text-slate-600">
        <CheckCircle2 size={16} className="text-slate-400" />
        <span className="font-medium text-slate-700">Gestao de processos</span>
        <span className="text-slate-400">[F10]</span>
      </div>

      {/* cabecalho editavel */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <div>
          <label className={`${LBL} flex items-center gap-1.5`}>Processo <Settings size={13} className="text-marca-400" /></label>
          <input className={`${INP} bg-slate-50 text-marca-700`} value={`[${p.numero ?? '-'}] ${p.nome}`} readOnly />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={`${LBL} flex items-center gap-1.5`}>Empresa <Heart size={13} className="text-marca-400" /></label>
            <span className="mb-1 text-[12px] font-medium text-marca-600">Inicio: {dataBR(p.dataInicio)}{p.gestorId && usuarios.length ? ` - ${usuarios.find((u) => u.id === p.gestorId)?.nome ?? ''}` : ''}</span>
          </div>
          <input className={`${INP} bg-slate-50`} value={`${p.empresa.razaoSocial} [${p.empresa.numero ?? '-'} | ${p.empresa.cnpjFinal ?? '----'}]`} readOnly />
        </div>

        <div>
          <label className={LBL}>Titulo do processo</label>
          <input className={INP} value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={!podeOperar} />
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
          <div className="flex items-end text-[12px] text-slate-500">
            <span><span className="font-semibold text-slate-600">Dpto:</span> <span className="text-marca-600">{dep ?? 'Indefinido na matriz'}</span></span>
          </div>
          <div>
            <label className={LBL}>Gestor desse processo</label>
            <select className={INP} value={gestorId} onChange={(e) => setGestorId(e.target.value)} disabled={!podeOperar}>
              <option value="">Selecione...</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={LBL}>Observacoes</label>
          <textarea className={INP} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={!podeOperar} />
        </div>
        <div className="flex flex-col justify-end">
          <div className="mb-1 flex items-center gap-2 text-[12px]">
            <span><span className="font-semibold text-marca-600">Status:</span> <span style={{ color: COR[p.status] }}>{statusTxt}</span></span>
            {podeOperar && p.status !== 'CANCELADO' && (
              <button title="Marcar desistencia" onClick={() => { if (confirm('Marcar processo como Desistencia?')) acao(() => api.post(`/processos/${id}/status`, { status: 'CANCELADO' }), 'Desistencia registrada.'); }} className="text-status-danger hover:opacity-70"><Trash2 size={15} /></button>
            )}
            {podeOperar && p.status !== 'EM_ANDAMENTO' && (
              <button title="Reativar (em andamento)" onClick={() => acao(() => api.post(`/processos/${id}/status`, { status: 'EM_ANDAMENTO' }), 'Reativado.')} className="text-marca-600 hover:opacity-70"><RotateCw size={15} /></button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={salvarCabecalho} disabled={salvando || !podeOperar} className="flex flex-1 items-center justify-center gap-2 rounded bg-status-ok px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={15} /> {salvando ? '...' : 'Salvar'}</button>
            <button onClick={() => navigate('/processos')} className="flex flex-1 items-center justify-center gap-2 rounded bg-status-warn px-5 py-2 text-[13px] font-medium text-white hover:bg-amber-500"><RotateCcw size={15} /> Voltar</button>
          </div>
        </div>
      </div>

      {/* evolucao do processo */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-slate-600">
          <span className="font-semibold">Evolucao do processo</span>
          <span className="text-slate-400">- iniciado ha {diasDesde(p.dataInicio)} dias</span>
          <button onClick={() => setOcultar((v) => !v)} title={ocultarDispensados ? 'Mostrar dispensados' : 'Ocultar dispensados'} className="text-marca-500 hover:text-marca-700">
            {ocultarDispensados ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div className="h-5 flex-1 overflow-hidden rounded-full" style={{ background: COR[p.status] + '22' }}>
          <div className="flex h-full items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ width: `${Math.max(progresso, 6)}%`, background: COR[p.status] }}>{progresso}%</div>
        </div>
      </div>

      {/* passos agrupados */}
      <div className="mt-3 space-y-2">
        {grupos.map((g) => {
          const aberto = !colapsados.has(g.chave);
          const lista = ocultarDispensados ? g.passos.filter((x) => x.status !== 'DISPENSADO') : g.passos;
          if (lista.length === 0) return null;
          return (
            <div key={g.chave} className="overflow-hidden rounded border border-slate-200 bg-white">
              <button onClick={() => setColapsados((s) => { const n = new Set(s); n.has(g.chave) ? n.delete(g.chave) : n.add(g.chave); return n; })}
                className="flex w-full items-center gap-1.5 bg-neutral-100 px-3 py-1.5 text-left text-[13px] font-medium text-marca-700">
                {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />} {g.nome} <span className="text-slate-400">()</span>
              </button>
              {aberto && (
                <div>
                  {lista.map((passo) => {
                    const disp = passo.status === 'DISPENSADO';
                    const ok = passo.status === 'CONCLUIDO';
                    return (
                      <div key={passo.id} className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 odd:bg-slate-50/40">
                        {/* checkbox/estado */}
                        {podeOperar && !ok && !disp ? (
                          <button title="Concluir" onClick={() => acao(() => api.post(`/processos/passos/${passo.id}/concluir`), 'Passo concluido.')} className="text-slate-400 hover:text-status-ok"><Square size={16} /></button>
                        ) : disp ? (
                          <Ban size={16} className="flex-shrink-0 text-status-danger" />
                        ) : (
                          <CheckSquare size={16} className="flex-shrink-0 text-status-ok" />
                        )}
                        {/* titulo */}
                        <span className={`flex-1 ${disp ? 'text-status-danger line-through' : 'text-slate-700'}`}>
                          {passo.titulo}{disp && <span className="ml-1 text-[11px]">(dispensado)</span>}
                        </span>
                        {/* dica (descricao) */}
                        {passo.descricao && (
                          <span className="hidden items-center gap-1 text-[12px] text-amber-600 md:flex"><Lightbulb size={13} /> {passo.descricao}</span>
                        )}
                        {/* visivel ao cliente (portal) */}
                        {podeOperar && (
                          <button
                            title={passo.visivelCliente ? 'Visivel ao cliente (clique para ocultar)' : 'Oculto do cliente (clique para compartilhar)'}
                            onClick={() => acao(() => api.post(`/processos/passos/${passo.id}/visivel-cliente`, { visivel: !passo.visivelCliente }), passo.visivelCliente ? 'Passo ocultado do cliente.' : 'Passo compartilhado com o cliente.')}
                            className={passo.visivelCliente ? 'text-marca-600' : 'text-slate-300 hover:text-slate-500'}>
                            {passo.visivelCliente ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                        )}
                        {/* acoes */}
                        {podeOperar && !ok && !disp && (
                          <button title="Dispensar" onClick={() => acao(() => api.post(`/processos/passos/${passo.id}/dispensar`), 'Passo dispensado.')} className="text-slate-300 hover:text-status-danger"><Ban size={15} /></button>
                        )}
                        {podeOperar && (ok || disp) && (
                          <button title="Reabrir passo" onClick={() => acao(() => api.post(`/processos/passos/${passo.id}/reabrir`), 'Passo reaberto.')} className="text-amber-500 hover:text-amber-700"><RotateCcw size={15} /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {podeOperar && (
        <button className="mt-3 rounded border border-slate-300 bg-white px-3 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50" onClick={() => { const t = prompt('Titulo do novo passo:'); if (t) acao(() => api.post(`/processos/${id}/passos`, { titulo: t }), 'Passo adicionado.'); }}>+ Adicionar passo avulso</button>
      )}
    </div>
  );
}
