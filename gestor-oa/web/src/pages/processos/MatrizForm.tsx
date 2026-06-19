import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2, Save, RotateCcw, Plus, X, Copy, CheckSquare, ChevronsDown,
  Shuffle, Mail, ArrowUp, ArrowDown, Trash2, SquarePen, History,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { InfoHint, Spinner, useToast } from '../../components/ui';
import type { Matriz, MatrizPasso, TipoPassoMatriz, DesdobramentoOpcao, Departamento } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-2 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 flex items-center gap-1 text-[13px] font-semibold text-slate-700';

const INFO_SUB = 'Marque como Sim caso essa seja uma matriz que so sera utilizada dentro de uma outra matriz, seja em forma de sub-matriz ou em uma opcao de desdobramento.\n\nExemplo: sub-matriz "Registro na junta comercial", que so e disparada pela matriz "Constituicao de empresa".';
const INFO_AUTORIZA = 'Marque Sim caso seja um processo que so pode ser iniciado mediante aprovacao de algum usuario com permissao para autorizacao de processos.';
const INFO_BARRA = 'Quantidade de dias corridos apos o inicio do processo, para a barra de progresso da % de evolucao do processo ficar vermelha.';

const TIPO_INFO: Record<TipoPassoMatriz, { label: string; icon: typeof CheckSquare; cor: string }> = {
  PASSO_SIMPLES: { label: 'Passo simples', icon: CheckSquare, cor: 'text-sky-600' },
  SUB_MATRIZ: { label: 'Sub-matriz', icon: ChevronsDown, cor: 'text-slate-500' },
  DESDOBRAMENTO: { label: 'Desdobramento', icon: Shuffle, cor: 'text-purple-600' },
  FOLLOW_UP: { label: 'Follow-up', icon: Mail, cor: 'text-amber-500' },
};

export default function MatrizForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [matrizesDisp, setMatrizesDisp] = useState<Matriz[]>([]);

  const [nome, setNome] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [soSubmatriz, setSoSubmatriz] = useState(false);
  const [pedeAutorizacao, setPedeAutorizacao] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [barraVermelhaDias, setBarraVermelhaDias] = useState(45);
  const [itens, setItens] = useState<MatrizPasso[]>([]);
  const [usadaPor, setUsadaPor] = useState<{ id: string; nome: string }[]>([]);
  const [editSub, setEditSub] = useState<number | null>(null);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<Matriz[]>('/matrizes').then(setMatrizesDisp).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (novo) return;
    api.get<Matriz>(`/matrizes/${id}`).then((m) => {
      setNome(m.nome); setDepartamentoId(m.departamentoId ?? '');
      setSoSubmatriz(m.soSubmatriz); setPedeAutorizacao(m.pedeAutorizacao); setAtivo(m.ativo);
      setBarraVermelhaDias(m.barraVermelhaDias ?? 45);
      setItens((m.passos ?? []).map((p) => ({ ...p, tipo: p.tipo ?? 'PASSO_SIMPLES' })));
      setUsadaPor(m.usadaPor ?? []);
    }).catch(() => toast('erro', 'Matriz nao encontrada.')).finally(() => setCarregando(false));
  }, [id, novo]);

  function addItem(tipo: TipoPassoMatriz) {
    setItens((arr) => [...arr, {
      ordem: arr.length + 1, tipo, titulo: '', prazoDias: 0, basePrazo: 'INICIO', bloqueante: false,
      acaoAutomatica: 'NENHUMA', config: tipo === 'DESDOBRAMENTO' ? { desdobramentos: [] } : {},
    }]);
  }
  function setItem(i: number, patch: Partial<MatrizPasso>) { setItens((arr) => arr.map((p, j) => (j === i ? { ...p, ...patch } : p))); }
  function remover(i: number) { setItens((arr) => arr.filter((_, j) => j !== i).map((p, idx) => ({ ...p, ordem: idx + 1 }))); }
  function mover(i: number, dir: -1 | 1) {
    setItens((arr) => {
      const j = i + dir; if (j < 0 || j >= arr.length) return arr;
      const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; return n.map((p, idx) => ({ ...p, ordem: idx + 1 }));
    });
  }
  // desdobramentos
  function setDesdob(i: number, desdobramentos: DesdobramentoOpcao[]) { setItem(i, { config: { ...(itens[i].config ?? {}), desdobramentos } }); }

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome da matriz.');
    setSalvando(true);
    try {
      const body = {
        nome, departamentoId: departamentoId || null, soSubmatriz, pedeAutorizacao, ativo,
        barraVermelhaDias: Number(barraVermelhaDias),
        ...(novo ? {} : { passos: itens.map((p, i) => ({ ...p, ordem: i + 1, prazoDias: Number(p.prazoDias) })) }),
      };
      if (novo) { const m = await api.post<{ id: string }>('/matrizes', body); toast('ok', 'Matriz criada.'); navigate(`/processos/matrizes/${m.id}`); }
      else { await api.put(`/matrizes/${id}`, body); toast('ok', 'Matriz salva.'); }
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
      <div className="mb-4 flex items-center gap-2 text-slate-600">
        <CheckCircle2 size={16} className="text-slate-400" />
        <span className="font-medium text-slate-700">Gestao de processos</span>
        <span className="text-slate-400">[F10]</span>
      </div>

      {/* cabecalho da matriz */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <label className={`${LBL} justify-between`}>
            <span>Nome da matriz de processos</span>
            <Copy size={14} className="cursor-pointer text-slate-400 hover:text-marca-500" onClick={() => toast('erro', 'Duplicar matriz: em construcao')} />
          </label>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className={LBL}>So sub-matriz? <InfoHint texto={INFO_SUB} /></label>
          <select className={INP} value={soSubmatriz ? 'sim' : 'nao'} onChange={(e) => setSoSubmatriz(e.target.value === 'sim')}><option value="nao">Nao</option><option value="sim">Sim</option></select>
        </div>
        <div>
          <label className={LBL}>Pede autorizacao? <InfoHint texto={INFO_AUTORIZA} /></label>
          <select className={INP} value={pedeAutorizacao ? 'sim' : 'nao'} onChange={(e) => setPedeAutorizacao(e.target.value === 'sim')}><option value="nao">Nao</option><option value="sim">Sim</option></select>
        </div>
        <div>
          <label className={LBL}>Ativo?</label>
          <select className={INP} value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}><option value="sim">Sim</option><option value="nao">Nao</option></select>
        </div>

        <div>
          <label className={LBL}>Departamento principal</label>
          <select className={INP} value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
            <option value="">Selecione...</option>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={LBL}>Barra vermelha apos (dias): <InfoHint texto={INFO_BARRA} /></label>
          <input type="number" className={INP} value={barraVermelhaDias} onChange={(e) => setBarraVermelhaDias(Number(e.target.value))} />
        </div>
        <div className="flex items-end gap-2 md:col-span-2">
          <button onClick={salvar} disabled={salvando} className="flex flex-1 items-center justify-center gap-2 rounded bg-status-ok px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={15} /> {salvando ? '...' : 'Salvar'}</button>
          <button onClick={() => navigate('/processos/matrizes/novo')} className="flex flex-1 items-center justify-center gap-2 rounded bg-marca-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-marca-600"><Plus size={15} /> Nova matriz</button>
          <button onClick={() => navigate('/processos/matrizes')} className="flex flex-1 items-center justify-center gap-2 rounded bg-status-warn px-4 py-2 text-[13px] font-medium text-white hover:bg-amber-500"><RotateCcw size={15} /> Voltar</button>
        </div>
      </div>

      {novo ? (
        <p className="mt-6 rounded border border-dashed border-slate-300 bg-white p-4 text-center text-slate-400">Salve a matriz para adicionar os passos, sub-matrizes e desdobramentos.</p>
      ) : (
        <>
          {/* botoes de tipo */}
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <button onClick={() => addItem('PASSO_SIMPLES')} className="flex items-center justify-center gap-2 rounded bg-sky-500 px-3 py-2 text-[13px] font-medium text-white hover:bg-sky-600"><CheckSquare size={15} /> Novo passo simples</button>
            <button onClick={() => addItem('SUB_MATRIZ')} className="flex items-center justify-center gap-2 rounded bg-slate-400 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-500"><ChevronsDown size={15} /> Nova sub-matriz</button>
            <button onClick={() => addItem('DESDOBRAMENTO')} className="flex items-center justify-center gap-2 rounded bg-purple-500 px-3 py-2 text-[13px] font-medium text-white hover:bg-purple-600"><Shuffle size={15} /> Novo desdobramento</button>
            <button onClick={() => addItem('FOLLOW_UP')} className="flex items-center justify-center gap-2 rounded bg-amber-400 px-3 py-2 text-[13px] font-medium text-white hover:bg-amber-500"><Mail size={15} /> Novo follow-up</button>
          </div>

          {/* cabecalho das colunas */}
          <div className="mt-3 grid grid-cols-[130px_1.3fr_1.6fr_90px] gap-3 border-b border-slate-300 px-2 py-2 text-[12px] font-semibold text-slate-600">
            <div>Tipo</div>
            <div>Descricao / <span className="text-marca-600">Tarefas</span> / <span className="text-amber-600">Obrigacoes</span></div>
            <div>Dicas / Sub-Passos / Desdobramentos</div>
            <div className="flex justify-end">
              <button title="Buscar historico de alteracoes dos passos" onClick={() => toast('erro', 'Historico de alteracoes: em construcao')} className="text-emerald-500 hover:text-emerald-700"><History size={16} /></button>
            </div>
          </div>

          {/* itens */}
          <div className="space-y-px">
            {itens.map((p, i) => {
              const tipo = p.tipo ?? 'PASSO_SIMPLES';
              const info = TIPO_INFO[tipo];
              const Icone = info.icon;
              const sub = p.subMatrizId ? matrizesDisp.find((m) => m.id === p.subMatrizId) : null;
              return (
                <div key={i} className="grid grid-cols-[130px_1.3fr_1.6fr_90px] items-start gap-3 bg-white px-2 py-2.5 odd:bg-slate-50/60">
                  {/* col 1 - tipo */}
                  <div className={`flex items-center gap-1.5 text-[12px] ${info.cor}`}><Icone size={15} /> {info.label}</div>

                  {/* col 2 - descricao */}
                  <div>
                    {tipo === 'SUB_MATRIZ' ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <button title="Alterar sub-matriz desse passo" onClick={() => setEditSub(editSub === i ? null : i)} className="flex-shrink-0 text-emerald-500 hover:text-emerald-700"><SquarePen size={14} /></button>
                          {sub ? (
                            <button onClick={() => navigate(`/processos/matrizes/${sub.id}`)} className="text-marca-600 hover:underline">{sub.nome}</button>
                          ) : (
                            <span className="italic text-slate-400">Sub-matriz nao definida</span>
                          )}
                        </div>
                        {(editSub === i || !sub) && (
                          <select className="mt-1 w-full rounded border border-slate-200 px-1.5 py-1 text-[12px] text-slate-600 outline-none focus:border-marca-400" value={p.subMatrizId ?? ''} onChange={(e) => { setItem(i, { subMatrizId: e.target.value || null }); setEditSub(null); }}>
                            <option value="">Selecione a sub-matriz...</option>
                            {matrizesDisp.filter((m) => m.id !== id && m.soSubmatriz).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                          </select>
                        )}
                        <div className="mt-1 pl-5 text-[11px] text-purple-500">Tarefas apos: inicio/autorizacao do processo</div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <SquarePen size={14} className="flex-shrink-0 text-emerald-500" />
                        <input className="w-full rounded border border-slate-200 px-1.5 py-1 text-[13px] text-marca-700 outline-none focus:border-marca-400" placeholder="Descricao" value={p.titulo} onChange={(e) => setItem(i, { titulo: e.target.value })} />
                      </div>
                    )}
                  </div>

                  {/* col 3 - dicas / sub-passos / desdobramentos */}
                  <div className="text-[12px]">
                    {tipo === 'PASSO_SIMPLES' && (
                      <input className="w-full rounded border border-slate-200 px-1.5 py-1 text-slate-600 outline-none focus:border-marca-400" placeholder="Dica (opcional)" value={p.descricao ?? ''} onChange={(e) => setItem(i, { descricao: e.target.value })} />
                    )}
                    {tipo === 'FOLLOW_UP' && (
                      <input className="w-full rounded border border-slate-200 px-1.5 py-1 text-slate-600 outline-none focus:border-marca-400" placeholder="Mensagem / observacao do follow-up" value={p.descricao ?? ''} onChange={(e) => setItem(i, { descricao: e.target.value })} />
                    )}
                    {tipo === 'SUB_MATRIZ' && (
                      sub ? (
                        <div>
                          <div className="font-semibold text-marca-600">Sub-Passos:</div>
                          <ul className="ml-3 list-disc text-slate-600">{sub.passos.map((sp, k) => <li key={k}>{sp.titulo}</li>)}</ul>
                        </div>
                      ) : <span className="text-slate-300">-</span>
                    )}
                    {tipo === 'DESDOBRAMENTO' && (
                      <DesdobramentoEditor
                        opcoes={p.config?.desdobramentos ?? []}
                        matrizes={matrizesDisp.filter((m) => m.id !== id)}
                        onChange={(ops) => setDesdob(i, ops)}
                      />
                    )}
                  </div>

                  {/* col 4 - acoes */}
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => mover(i, -1)} title="Subir na ordenacao" className="text-emerald-500 hover:text-emerald-700"><ArrowUp size={15} /></button>
                    <button onClick={() => mover(i, 1)} title="Descer na ordenacao" className="text-amber-500 hover:text-amber-700"><ArrowDown size={15} /></button>
                    <button onClick={() => remover(i)} title="Remover do processo" className="text-status-danger hover:opacity-70"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
            {itens.length === 0 && <div className="bg-white px-3 py-10 text-center text-slate-400">Use os botoes acima para adicionar passos, sub-matrizes e desdobramentos.</div>}
          </div>

          <button onClick={salvar} disabled={salvando} className="mt-3 flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={15} /> Salvar matriz</button>

          {/* matrizes que usam esta como sub-matriz */}
          {usadaPor.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="mb-2 text-[13px] font-semibold text-slate-700">Matrizes que utilizam essa matriz como sub-matriz</div>
              <div className="space-y-1">
                {usadaPor.map((u) => (
                  <button key={u.id} onClick={() => navigate(`/processos/matrizes/${u.id}`)} className="flex items-center gap-1.5 text-[13px] text-marca-600 hover:underline">
                    <CheckSquare size={14} className="text-emerald-500" /> {u.nome}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DesdobramentoEditor({ opcoes, matrizes, onChange }: { opcoes: DesdobramentoOpcao[]; matrizes: Matriz[]; onChange: (o: DesdobramentoOpcao[]) => void }) {
  function add() { onChange([...opcoes, { label: '', acao: 'CONCLUI', alvoMatrizId: null }]); }
  function set(i: number, patch: Partial<DesdobramentoOpcao>) { onChange(opcoes.map((o, j) => (j === i ? { ...o, ...patch } : o))); }
  function rem(i: number) { onChange(opcoes.filter((_, j) => j !== i)); }
  return (
    <div>
      <div className="mb-1 font-semibold text-amber-600">Desdobramentos:</div>
      <div className="space-y-1">
        {opcoes.map((o, i) => (
          <div key={i} className="flex items-center gap-1">
            <input className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-[12px] outline-none focus:border-marca-400" placeholder="Resposta" value={o.label} onChange={(e) => set(i, { label: e.target.value })} />
            <span className="text-slate-400">&raquo;</span>
            <select className="rounded border border-slate-200 px-1 py-0.5 text-[12px] outline-none focus:border-marca-400" value={o.acao} onChange={(e) => set(i, { acao: e.target.value as DesdobramentoOpcao['acao'] })}>
              <option value="CONCLUI">Conclui o passo</option>
              <option value="SUBMATRIZ">Abre sub-matriz</option>
            </select>
            {o.acao === 'SUBMATRIZ' && (
              <select className="rounded border border-slate-200 px-1 py-0.5 text-[12px] outline-none focus:border-marca-400" value={o.alvoMatrizId ?? ''} onChange={(e) => set(i, { alvoMatrizId: e.target.value || null })}>
                <option value="">Matriz...</option>
                {matrizes.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            )}
            <button onClick={() => rem(i)} className="text-slate-300 hover:text-status-danger"><X size={13} /></button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-1 flex items-center gap-1 text-[12px] text-marca-600 hover:underline"><Plus size={12} /> opcao</button>
    </div>
  );
}
