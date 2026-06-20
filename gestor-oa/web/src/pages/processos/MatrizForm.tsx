import { useEffect, useRef, useState } from 'react';
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
const INFO_BLOQ = 'Se "Sim", os passos seguintes so poderao ser concluidos depois que este passo for concluido (passo bloqueante).';
const INFO_ANEXO = 'Se "Sim", sera obrigatorio anexar um arquivo para concluir este passo.';

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
  const [editando, setEditando] = useState<number | null>(null);
  const [criando, setCriando] = useState<'PASSO' | 'SUB' | 'DESD' | 'FOLLOW' | null>(null);
  const [nForm, setNForm] = useState({
    nome: '', bloqueante: false, exigeAnexo: false, apareceApp: false,
    acao: 'NENHUMA' as 'NENHUMA' | 'CRIAR_TAREFA' | 'CRIAR_OBRIGACAO_NA_EMPRESA',
    propagacao: 'NAO_CONCLUIDOS' as 'NAO_CONCLUIDOS' | 'NOVOS', dica: '', inserirApos: -2, // -1 = inicio, -2 = fim
  });
  const [sForm, setSForm] = useState({ subMatrizId: '', criarApos: 'INICIO', propagacao: 'NAO_CONCLUIDOS' as 'NAO_CONCLUIDOS' | 'NOVOS', inserirApos: -2 });
  const [dForm, setDForm] = useState({ pergunta: '', propagacao: 'NAO_CONCLUIDOS' as 'NAO_CONCLUIDOS' | 'NOVOS', inserirApos: -2, opcoes: [] as DesdobramentoOpcao[], optLabel: '', optAlvo: '' });

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

  function inserirNa(arr: MatrizPasso[], novo: MatrizPasso, inserirApos: number) {
    const pos = inserirApos === -1 ? 0 : inserirApos === -2 ? arr.length : inserirApos + 1;
    return [...arr.slice(0, pos), novo, ...arr.slice(pos)].map((p, idx) => ({ ...p, ordem: idx + 1 }));
  }

  const ultimoIdx = () => (itens.length ? itens.length - 1 : -1);

  function abrirNovoPasso() {
    setNForm({ nome: '', bloqueante: false, exigeAnexo: false, apareceApp: false, acao: 'NENHUMA', propagacao: 'NAO_CONCLUIDOS', dica: '', inserirApos: ultimoIdx() });
    setCriando('PASSO'); setEditando(null);
  }
  function adicionarPasso() {
    if (nForm.nome.trim().length < 1) return toast('erro', 'Informe o nome do passo.');
    const novo: MatrizPasso = {
      ordem: 0, tipo: 'PASSO_SIMPLES', titulo: nForm.nome.trim(), descricao: nForm.dica.trim() || null,
      prazoDias: 0, basePrazo: 'INICIO', bloqueante: nForm.bloqueante, visivelCliente: nForm.apareceApp, acaoAutomatica: nForm.acao,
      config: { exigeAnexo: nForm.exigeAnexo, apareceApp: nForm.apareceApp, propagacao: nForm.propagacao },
    };
    setItens((arr) => inserirNa(arr, novo, nForm.inserirApos));
    setCriando(null);
  }

  function abrirNovaSub() {
    setSForm({ subMatrizId: '', criarApos: 'INICIO', propagacao: 'NAO_CONCLUIDOS', inserirApos: ultimoIdx() });
    setCriando('SUB'); setEditando(null);
  }

  function abrirNovoDesd() {
    setDForm({ pergunta: '', propagacao: 'NAO_CONCLUIDOS', inserirApos: ultimoIdx(), opcoes: [], optLabel: '', optAlvo: '' });
    setCriando('DESD'); setEditando(null);
  }
  function addOpcaoDesd() {
    if (!dForm.optLabel.trim()) return toast('erro', 'Informe a opcao de desdobramento.');
    const op: DesdobramentoOpcao = { label: dForm.optLabel.trim(), acao: dForm.optAlvo ? 'SUBMATRIZ' : 'CONCLUI', alvoMatrizId: dForm.optAlvo || null };
    setDForm((f) => ({ ...f, opcoes: [...f.opcoes, op], optLabel: '', optAlvo: '' }));
  }
  function adicionarDesd() {
    if (dForm.pergunta.trim().length < 1) return toast('erro', 'Informe o nome/pergunta do desdobramento.');
    if (dForm.opcoes.length === 0) return toast('erro', 'Adicione ao menos uma opcao de desdobramento.');
    const novo: MatrizPasso = {
      ordem: 0, tipo: 'DESDOBRAMENTO', titulo: dForm.pergunta.trim(), prazoDias: 0, basePrazo: 'INICIO',
      bloqueante: false, acaoAutomatica: 'NENHUMA', config: { desdobramentos: dForm.opcoes, propagacao: dForm.propagacao },
    };
    setItens((arr) => inserirNa(arr, novo, dForm.inserirApos));
    setCriando(null);
  }

  function adicionarFollow(novo: MatrizPasso, inserirApos: number) {
    setItens((arr) => inserirNa(arr, novo, inserirApos));
    setCriando(null);
  }
  function adicionarSub() {
    if (!sForm.subMatrizId) return toast('erro', 'Selecione a sub-matriz.');
    const novo: MatrizPasso = {
      ordem: 0, tipo: 'SUB_MATRIZ', titulo: '', prazoDias: 0, basePrazo: 'INICIO', bloqueante: false,
      acaoAutomatica: 'NENHUMA', subMatrizId: sForm.subMatrizId,
      config: { criarApos: sForm.criarApos, propagacao: sForm.propagacao },
    };
    setItens((arr) => inserirNa(arr, novo, sForm.inserirApos));
    setCriando(null);
  }

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
            <button onClick={abrirNovoPasso} className="flex items-center justify-center gap-2 rounded bg-sky-500 px-3 py-2 text-[13px] font-medium text-white hover:bg-sky-600"><CheckSquare size={15} /> Novo passo simples</button>
            <button onClick={abrirNovaSub} className="flex items-center justify-center gap-2 rounded bg-slate-400 px-3 py-2 text-[13px] font-medium text-white hover:bg-slate-500"><ChevronsDown size={15} /> Nova sub-matriz</button>
            <button onClick={abrirNovoDesd} className="flex items-center justify-center gap-2 rounded bg-purple-500 px-3 py-2 text-[13px] font-medium text-white hover:bg-purple-600"><Shuffle size={15} /> Novo desdobramento</button>
            <button onClick={() => { setEditando(null); setCriando('FOLLOW'); }} className="flex items-center justify-center gap-2 rounded bg-amber-400 px-3 py-2 text-[13px] font-medium text-white hover:bg-amber-500"><Mail size={15} /> Novo follow-up</button>
          </div>

          {/* form Novo desdobramento */}
          {criando === 'DESD' && (
            <div className="mt-3 space-y-3 rounded border border-purple-200 bg-purple-50/50 p-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-amber-600">Essa matriz ja esta em uso, o que deseja fazer com este novo desdobramento nos processos?</label>
                <select className={`${INP} text-marca-600`} value={dForm.propagacao} onChange={(e) => setDForm((f) => ({ ...f, propagacao: e.target.value as typeof f.propagacao }))}>
                  <option value="NAO_CONCLUIDOS">Adicionar em todos os nao-concluidos e em novos usos</option>
                  <option value="NOVOS">Adicionar somente em novos usos dessa matriz</option>
                </select>
              </div>
              {/* construtor de opcoes */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.4fr_1fr_1.4fr_auto] md:items-center">
                <input className={INP} placeholder="Nome ou pergunta para o desdobramento" value={dForm.pergunta} onChange={(e) => setDForm((f) => ({ ...f, pergunta: e.target.value }))} autoFocus />
                <input className={INP} placeholder="Opcao de desdobramento" value={dForm.optLabel} onChange={(e) => setDForm((f) => ({ ...f, optLabel: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addOpcaoDesd()} />
                <select className={INP} value={dForm.optAlvo} onChange={(e) => setDForm((f) => ({ ...f, optAlvo: e.target.value }))}>
                  <option value="">Desdobramento: conclui o passo</option>
                  {matrizesDisp.filter((m) => m.id !== id).map((m) => <option key={m.id} value={m.id}>Sub-matriz: {m.nome}</option>)}
                </select>
                <button onClick={addOpcaoDesd} className="flex items-center justify-center gap-2 rounded bg-purple-500 px-4 py-2 text-[12px] font-medium text-white hover:bg-purple-600"><Plus size={14} /> Adicionar</button>
              </div>
              {/* opcoes adicionadas */}
              {dForm.opcoes.length === 0 ? (
                <div className="text-[12px] italic text-amber-600">Nenhum desdobramento criado ainda</div>
              ) : (
                <ul className="space-y-1">
                  {dForm.opcoes.map((o, k) => (
                    <li key={k} className="flex items-center gap-2 text-[12px] text-slate-600">
                      <span className="font-medium text-purple-700">{o.label}</span>
                      <span className="text-slate-400">&raquo;</span>
                      <span>{o.acao === 'CONCLUI' ? 'Conclui o passo' : `Sub-matriz: ${matrizesDisp.find((m) => m.id === o.alvoMatrizId)?.nome ?? '...'}`}</span>
                      <button onClick={() => setDForm((f) => ({ ...f, opcoes: f.opcoes.filter((_, j) => j !== k) }))} className="text-slate-300 hover:text-status-danger"><X size={13} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.6fr_auto_auto] md:items-end">
                <div>
                  <label className={LBL}>Inserir apos:</label>
                  <select className={INP} value={dForm.inserirApos} onChange={(e) => setDForm((f) => ({ ...f, inserirApos: Number(e.target.value) }))}>
                    <option value={-1}>Inserir no Inicio</option>
                    {itens.map((it, idx) => {
                      const lbl = (it.tipo ?? 'PASSO_SIMPLES') === 'SUB_MATRIZ'
                        ? `Sub-Proc: ${matrizesDisp.find((m) => m.id === it.subMatrizId)?.nome ?? '...'}`
                        : (it.titulo || '(sem nome)');
                      return <option key={idx} value={idx}>{lbl}</option>;
                    })}
                  </select>
                </div>
                <button onClick={adicionarDesd} className="flex items-center justify-center gap-2 rounded bg-marca-500 px-5 py-2 text-[13px] font-medium text-white hover:bg-marca-600"><Save size={15} /> Adicionar</button>
                <button onClick={() => setCriando(null)} className="flex items-center justify-center gap-2 rounded bg-status-danger px-5 py-2 text-[13px] font-medium text-white hover:bg-red-600"><X size={15} /> Cancelar</button>
              </div>
            </div>
          )}

          {/* form Nova sub-matriz */}
          {criando === 'SUB' && (
            <div className="mt-3 space-y-3 rounded border border-slate-300 bg-slate-100/60 p-3">
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
                <div>
                  <label className={LBL}>Selecione a sub-matriz desejada:</label>
                  <select className={`${INP} text-marca-600`} value={sForm.subMatrizId} onChange={(e) => setSForm((f) => ({ ...f, subMatrizId: e.target.value }))} autoFocus>
                    <option value="">Selecione a sub-matriz desejada</option>
                    {matrizesDisp.filter((m) => m.id !== id).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>Possiveis sub-tarefas, criar apos:</label>
                  <select className={INP} value={sForm.criarApos} onChange={(e) => setSForm((f) => ({ ...f, criarApos: e.target.value }))}>
                    <option value="INICIO">Inicio/autorizacao do processo</option>
                    {itens.filter((it) => (it.tipo ?? 'PASSO_SIMPLES') === 'PASSO_SIMPLES' && it.titulo).map((it, k) => (
                      <option key={k} value={it.titulo}>Ok do '{it.titulo}'</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-amber-600">Essa matriz ja esta em uso, o que deseja fazer com esta nova sub-matriz nos processos?</label>
                <select className={`${INP} text-marca-600`} value={sForm.propagacao} onChange={(e) => setSForm((f) => ({ ...f, propagacao: e.target.value as typeof f.propagacao }))}>
                  <option value="NAO_CONCLUIDOS">Adicionar em todos os nao-concluidos e em novos usos</option>
                  <option value="NOVOS">Adicionar somente em novos usos dessa matriz</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.6fr_auto_auto] md:items-end">
                <div>
                  <label className={LBL}>Inserir apos:</label>
                  <select className={INP} value={sForm.inserirApos} onChange={(e) => setSForm((f) => ({ ...f, inserirApos: Number(e.target.value) }))}>
                    <option value={-1}>Inserir no Inicio</option>
                    {itens.map((it, idx) => {
                      const lbl = (it.tipo ?? 'PASSO_SIMPLES') === 'SUB_MATRIZ'
                        ? `Sub-Proc: ${matrizesDisp.find((m) => m.id === it.subMatrizId)?.nome ?? '...'}`
                        : (it.titulo || '(sem nome)');
                      return <option key={idx} value={idx}>{lbl}</option>;
                    })}
                  </select>
                </div>
                <button onClick={adicionarSub} className="flex items-center justify-center gap-2 rounded bg-marca-500 px-5 py-2 text-[13px] font-medium text-white hover:bg-marca-600"><Save size={15} /> Adicionar</button>
                <button onClick={() => setCriando(null)} className="flex items-center justify-center gap-2 rounded bg-status-danger px-5 py-2 text-[13px] font-medium text-white hover:bg-red-600"><X size={15} /> Cancelar</button>
              </div>
            </div>
          )}

          {/* form Novo passo simples */}
          {criando === 'PASSO' && (
            <div className="mt-3 space-y-3 rounded border border-sky-200 bg-sky-50/50 p-3">
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                <div>
                  <label className={LBL}>Nome do passo</label>
                  <input className={INP} placeholder="Nome do novo passo" value={nForm.nome} onChange={(e) => setNForm((f) => ({ ...f, nome: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className={LBL}>Bloqueante? <InfoHint texto={INFO_BLOQ} /></label>
                  <select className={INP} value={nForm.bloqueante ? 'sim' : 'nao'} onChange={(e) => setNForm((f) => ({ ...f, bloqueante: e.target.value === 'sim' }))}><option value="nao">Nao</option><option value="sim">Sim</option></select>
                </div>
                <div>
                  <label className={LBL}>Exige anexo? <InfoHint texto={INFO_ANEXO} /></label>
                  <select className={INP} value={nForm.exigeAnexo ? 'sim' : 'nao'} onChange={(e) => setNForm((f) => ({ ...f, exigeAnexo: e.target.value === 'sim' }))}><option value="nao">Nao</option><option value="sim">Sim</option></select>
                </div>
                <div>
                  <label className={LBL}>Aparece no App?</label>
                  <select className={INP} value={nForm.apareceApp ? 'sim' : 'nao'} onChange={(e) => setNForm((f) => ({ ...f, apareceApp: e.target.value === 'sim' }))}><option value="nao">Nao</option><option value="sim">Sim</option></select>
                </div>
                <div>
                  <label className={LBL}>Passo criara tarefa ou obrigacao?</label>
                  <select className={INP} value={nForm.acao} onChange={(e) => setNForm((f) => ({ ...f, acao: e.target.value as typeof f.acao }))}>
                    <option value="NENHUMA">Nao</option>
                    <option value="CRIAR_TAREFA">Criara uma Tarefa</option>
                    <option value="CRIAR_OBRIGACAO_NA_EMPRESA">Criara uma Obrigacao</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-amber-600">Essa matriz ja esta em uso, o que deseja fazer com este novo passo nos processos?</label>
                <select className={`${INP} text-marca-600`} value={nForm.propagacao} onChange={(e) => setNForm((f) => ({ ...f, propagacao: e.target.value as typeof f.propagacao }))}>
                  <option value="NAO_CONCLUIDOS">Adicionar em todos os nao-concluidos e em novos usos</option>
                  <option value="NOVOS">Adicionar somente em novos usos dessa matriz</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.6fr_1fr_auto_auto] md:items-end">
                <div>
                  <label className={LBL}>Dicas / Macetes</label>
                  <input className={INP} placeholder="Dicas / Macetes para realizar o passo" value={nForm.dica} onChange={(e) => setNForm((f) => ({ ...f, dica: e.target.value }))} />
                </div>
                <div>
                  <label className={LBL}>Inserir apos:</label>
                  <select className={INP} value={nForm.inserirApos} onChange={(e) => setNForm((f) => ({ ...f, inserirApos: Number(e.target.value) }))}>
                    <option value={-1}>Inserir no Inicio</option>
                    {itens.map((it, idx) => {
                      const lbl = (it.tipo ?? 'PASSO_SIMPLES') === 'SUB_MATRIZ'
                        ? `Sub-Proc: ${matrizesDisp.find((m) => m.id === it.subMatrizId)?.nome ?? '...'}`
                        : (it.titulo || '(sem nome)');
                      return <option key={idx} value={idx}>{lbl}</option>;
                    })}
                  </select>
                </div>
                <button onClick={adicionarPasso} className="flex items-center justify-center gap-2 rounded bg-marca-500 px-5 py-2 text-[13px] font-medium text-white hover:bg-marca-600"><Save size={15} /> Adicionar</button>
                <button onClick={() => setCriando(null)} className="flex items-center justify-center gap-2 rounded bg-status-danger px-5 py-2 text-[13px] font-medium text-white hover:bg-red-600"><X size={15} /> Cancelar</button>
              </div>
            </div>
          )}

          {/* cabecalho das colunas */}
          <div className="mt-3 grid grid-cols-[130px_1.3fr_1.6fr_90px] gap-3 border-b border-slate-300 px-2 py-2 text-[12px] font-semibold text-slate-600">
            <div>Tipo</div>
            <div>Descricao / <span className="text-marca-600">Tarefas</span> / <span className="text-amber-600">Obrigacoes</span></div>
            <div>Dicas / Sub-Passos / Desdobramentos</div>
            <div className="flex justify-end">
              <button title="Buscar historico de alteracoes dos passos" onClick={() => toast('erro', 'Historico de alteracoes: em construcao')} className="text-emerald-500 hover:text-emerald-700"><History size={16} /></button>
            </div>
          </div>

          {/* itens (lista de exibicao + painel de edicao ao clicar) */}
          <div>
            {itens.map((p, i) => {
              const tipo = p.tipo ?? 'PASSO_SIMPLES';
              const info = TIPO_INFO[tipo];
              const Icone = info.icon;
              const sub = p.subMatrizId ? matrizesDisp.find((m) => m.id === p.subMatrizId) : null;
              const nomeExib = tipo === 'SUB_MATRIZ' ? (sub?.nome ?? 'Sub-matriz nao definida') : (p.titulo || 'Sem descricao');
              const editavel = editando === i;
              return (
                <div key={i} className="border-b border-slate-100">
                  {/* linha de exibicao */}
                  <div className="grid grid-cols-[130px_1.3fr_1.6fr_90px] items-start gap-3 bg-white px-2 py-2.5 odd:bg-slate-50/60">
                    {/* col 1 - tipo */}
                    <div className={`flex items-center gap-1.5 text-[12px] ${info.cor}`}><Icone size={15} /> {info.label}</div>

                    {/* col 2 - descricao (link) + tarefas/obrigacoes */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <button title="Editar este passo" onClick={() => setEditando(editavel ? null : i)} className="flex-shrink-0 text-emerald-500 hover:text-emerald-700"><SquarePen size={14} /></button>
                        {tipo === 'SUB_MATRIZ' && sub ? (
                          <button onClick={() => navigate(`/processos/matrizes/${sub.id}`)} className="text-left text-marca-600 hover:underline">{nomeExib}</button>
                        ) : (
                          <button onClick={() => setEditando(editavel ? null : i)} className={`text-left hover:underline ${p.titulo ? 'text-marca-600' : 'italic text-slate-400'}`}>{nomeExib}</button>
                        )}
                      </div>
                      {tipo === 'SUB_MATRIZ' && <div className="mt-0.5 pl-5 text-[11px] text-purple-500">Tarefas apos: {!p.config?.criarApos || p.config.criarApos === 'INICIO' ? 'inicio/autorizacao do processo' : `Ok do '${p.config.criarApos}'`}</div>}
                      {p.config?.tarefas && <div className="pl-5 text-[11px] text-marca-500">Tarefas: {p.config.tarefas}</div>}
                      {p.config?.obrigacoes && <div className="pl-5 text-[11px] text-amber-600">Obrigacoes: {p.config.obrigacoes}</div>}
                    </div>

                    {/* col 3 - dicas / sub-passos / desdobramentos (exibicao) */}
                    <div className="text-[12px] text-slate-600">
                      {(tipo === 'PASSO_SIMPLES' || tipo === 'FOLLOW_UP') && (p.descricao || <span className="text-slate-300">-</span>)}
                      {tipo === 'SUB_MATRIZ' && (sub ? (
                        <div>
                          <div className="font-semibold text-marca-600">Sub-Passos:</div>
                          <ul className="ml-3 list-disc">{sub.passos.map((sp, k) => <li key={k}>{sp.titulo}</li>)}</ul>
                        </div>
                      ) : <span className="text-slate-300">-</span>)}
                      {tipo === 'DESDOBRAMENTO' && ((p.config?.desdobramentos?.length ?? 0) > 0 ? (
                        <div>
                          <div className="font-semibold text-amber-600">Desdobramentos:</div>
                          <ul className="ml-3 list-disc">
                            {p.config!.desdobramentos!.map((o, k) => (
                              <li key={k}>{o.label || '?'} <span className="text-slate-400">&raquo;</span> {o.acao === 'CONCLUI' ? 'Conclui o passo' : (matrizesDisp.find((m) => m.id === o.alvoMatrizId)?.nome ?? 'sub-matriz')}</li>
                            ))}
                          </ul>
                        </div>
                      ) : <span className="text-slate-300">-</span>)}
                    </div>

                    {/* col 4 - acoes */}
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => mover(i, -1)} title="Subir na ordenacao" className="text-emerald-500 hover:text-emerald-700"><ArrowUp size={15} /></button>
                      <button onClick={() => mover(i, 1)} title="Descer na ordenacao" className="text-amber-500 hover:text-amber-700"><ArrowDown size={15} /></button>
                      <button onClick={() => remover(i)} title="Remover do processo" className="text-status-danger hover:opacity-70"><Trash2 size={15} /></button>
                    </div>
                  </div>

                  {/* painel de edicao */}
                  {editavel && (
                    <div className="space-y-2 border-t border-marca-100 bg-marca-50/40 px-3 py-3">
                      {tipo === 'SUB_MATRIZ' ? (
                        <div>
                          <label className="mb-1 block text-[12px] font-semibold text-slate-600">Sub-matriz desse passo</label>
                          <select className={`${INP} max-w-md`} value={p.subMatrizId ?? ''} onChange={(e) => setItem(i, { subMatrizId: e.target.value || null })}>
                            <option value="">Selecione a sub-matriz...</option>
                            {matrizesDisp.filter((m) => m.id !== id).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="mb-1 block text-[12px] font-semibold text-slate-600">Descricao</label>
                            <input className={`${INP} max-w-2xl`} placeholder="Descricao do passo" value={p.titulo} onChange={(e) => setItem(i, { titulo: e.target.value })} />
                          </div>
                          {tipo === 'DESDOBRAMENTO' ? (
                            <div>
                              <label className="mb-1 block text-[12px] font-semibold text-slate-600">Desdobramentos</label>
                              <DesdobramentoEditor opcoes={p.config?.desdobramentos ?? []} matrizes={matrizesDisp.filter((m) => m.id !== id)} onChange={(ops) => setDesdob(i, ops)} />
                            </div>
                          ) : (
                            <div>
                              <label className="mb-1 block text-[12px] font-semibold text-slate-600">{tipo === 'FOLLOW_UP' ? 'Mensagem do follow-up' : 'Dica (opcional)'}</label>
                              <input className={`${INP} max-w-2xl`} placeholder={tipo === 'FOLLOW_UP' ? 'Mensagem / observacao' : 'Dica'} value={p.descricao ?? ''} onChange={(e) => setItem(i, { descricao: e.target.value })} />
                            </div>
                          )}
                        </>
                      )}
                      <button onClick={() => setEditando(null)} className="rounded bg-marca-500 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-marca-600">Concluir edicao</button>
                    </div>
                  )}
                </div>
              );
            })}
            {itens.length === 0 && <div className="border-b border-slate-100 bg-white px-3 py-10 text-center text-slate-400">Use os botoes acima para adicionar passos, sub-matrizes e desdobramentos.</div>}
          </div>

          <button onClick={salvar} disabled={salvando} className="mt-3 flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={15} /> Salvar matriz</button>

          {criando === 'FOLLOW' && (
            <FollowUpModal itens={itens} matrizesDisp={matrizesDisp} onSalvar={adicionarFollow} onClose={() => setCriando(null)} />
          )}

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

const VARIAVEIS: { v: string; d: string }[] = [
  { v: 'NomeMatriz', d: 'Nome da matriz do processo' },
  { v: 'NomeResp', d: 'Gestor do processo' },
  { v: 'NCompResp', d: 'Nome completo do gestor do processo' },
  { v: 'Office', d: "Escritorio (mesmo do 'From' dos e-mails)" },
  { v: 'NomeDest', d: 'Primeiro nome do destinatario' },
  { v: 'EmpresaCli', d: 'Nome da empresa do cliente' },
  { v: 'EmpresaCNPJ', d: 'CNPJ da empresa do cliente' },
  { v: 'EmpresaID', d: 'ID da empresa do cliente' },
  { v: 'EmpresaGrupo', d: 'Grupo da empresa do cliente' },
  { v: 'EmpresaFantasia', d: 'Nome Fantasia da empresa' },
  { v: 'DataAtual', d: 'Data atual' },
  { v: 'ProcID', d: 'ID do processo' },
  { v: 'ProcTitulo', d: 'Titulo do processo' },
  { v: 'PProcesso', d: 'Porcentagem atual do processo' },
  { v: 'PDias', d: 'Qtde de dias do inicio do processo' },
  { v: 'LogoEmpresa', d: 'Logo da Empresa/Carteira' },
  { v: 'SigMail', d: 'Assinatura do e-mail' },
];
const TOOLBAR = ['A', 'T', 'B', 'I', 'S', 'U', 'lista', 'align', 'recuo-', 'recuo+', 'tabela', 'link', 'undo', 'redo', 'cor', 'hr', 'tela', 'limpar', '</>'];

function FollowUpModal({ itens, matrizesDisp, onSalvar, onClose }: { itens: MatrizPasso[]; matrizesDisp: Matriz[]; onSalvar: (item: MatrizPasso, inserirApos: number) => void; onClose: () => void }) {
  const toast = useToast();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [titulo, setTitulo] = useState('');
  const [envio, setEnvio] = useState('MANUAL');
  const [destinatario, setDestinatario] = useState('TODOS_CONTATOS');
  const [corpo, setCorpo] = useState('');
  const [propagar, setPropagar] = useState(true);
  const [inserirApos, setInserirApos] = useState(itens.length ? itens.length - 1 : -1);

  function inserirVar(v: string) {
    const el = bodyRef.current;
    const token = `[${v}]`;
    if (!el) { setCorpo((c) => c + token); return; }
    const ini = el.selectionStart ?? corpo.length;
    const fim = el.selectionEnd ?? corpo.length;
    const novo = corpo.slice(0, ini) + token + corpo.slice(fim);
    setCorpo(novo);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = ini + token.length; });
  }

  function salvar() {
    const item: MatrizPasso = {
      ordem: 0, tipo: 'FOLLOW_UP', titulo: (titulo.trim() || 'Follow-up'), descricao: corpo.trim() || null,
      prazoDias: 0, basePrazo: 'INICIO', bloqueante: false, acaoAutomatica: 'NENHUMA',
      config: { followup: { mensagem: corpo }, dica: titulo, propagacao: propagar ? 'NAO_CONCLUIDOS' : 'NOVOS', envio, destinatario } as never,
    };
    onSalvar(item, inserirApos);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-4 w-full max-w-5xl rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-[15px] font-semibold text-marca-600">Criando e-mail de Follow-Up a ser enviado <span className="text-status-danger">(nao utilizar aspas)</span></div>

        {/* legenda de variaveis */}
        <div className="mb-3 rounded bg-slate-50 p-2 text-[11px]">
          <span className="font-semibold text-slate-600">Legenda das variaveis:</span> <span className="text-slate-500">os colchetes [...] serao substituidos no corpo do e-mail. Dica: [clique p/ inserir]</span>
          <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 md:grid-cols-3">
            {VARIAVEIS.map((x) => (
              <button key={x.v} onClick={() => inserirVar(x.v)} className="text-left hover:underline"><span className="text-marca-600">[{x.v}]</span> <span className="text-slate-500">= {x.d}</span></button>
            ))}
          </div>
        </div>

        {/* titulo / envio / destinatario */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label className={LBL}>Titulo do e-mail (pode utilizar variaveis)</label>
            <input className={INP} placeholder="Titulo do e-mail - tambem pode utilizar variaveis" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Envio do follow-up ocorrera:</label>
            <select className={INP} value={envio} onChange={(e) => setEnvio(e.target.value)}>
              <option value="MANUAL">Manualmente</option>
              <option value="AO_ATINGIR">Automaticamente ao atingir este passo</option>
            </select>
          </div>
          <div>
            <label className={LBL}>Destinatario do e-mail:</label>
            <select className={INP} value={destinatario} onChange={(e) => setDestinatario(e.target.value)}>
              <option value="TODOS_CONTATOS">Todos os contatos da empresa</option>
              <option value="CONTATO_PRINCIPAL">Contato principal</option>
              <option value="GESTOR">Gestor do processo</option>
            </select>
          </div>
        </div>

        {/* editor */}
        <div className="mt-3 overflow-hidden rounded border border-slate-300">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
            {TOOLBAR.map((t, k) => <span key={k} className="grid h-6 min-w-[22px] place-items-center rounded px-1 hover:bg-slate-200">{t}</span>)}
          </div>
          <textarea ref={bodyRef} className="h-64 w-full resize-y p-3 text-[13px] text-slate-700 outline-none" placeholder="Escreva algo..." value={corpo} onChange={(e) => setCorpo(e.target.value)} />
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-400">
            <span>Palavras: {corpo.trim() ? corpo.trim().split(/\s+/).length : 0}</span><span>Caracteres: {corpo.length}</span>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-[12px] text-slate-600">
          <input type="checkbox" checked={propagar} onChange={(e) => setPropagar(e.target.checked)} className="accent-marca-600" />
          Inserir esse novo follow-up nos processos (nao-concluidos) que ja estao usando essa matriz
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_auto_auto_auto] md:items-center">
          <select className={INP} value={inserirApos} onChange={(e) => setInserirApos(Number(e.target.value))}>
            <option value={-1}>Inserir apos: Inicio</option>
            {itens.map((it, idx) => {
              const lbl = (it.tipo ?? 'PASSO_SIMPLES') === 'SUB_MATRIZ'
                ? `Sub-Proc: ${matrizesDisp.find((m) => m.id === it.subMatrizId)?.nome ?? '...'}`
                : (it.titulo || '(sem nome)');
              return <option key={idx} value={idx}>Inserir apos: '{lbl}'</option>;
            })}
          </select>
          <button onClick={salvar} className="flex items-center justify-center gap-2 rounded bg-status-ok px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-600"><Save size={15} /> Salvar</button>
          <button onClick={() => toast('erro', 'Enviar modelo: em construcao')} className="flex items-center justify-center gap-2 rounded bg-sky-400 px-5 py-2 text-[13px] font-medium text-white hover:bg-sky-500"><Mail size={15} /> Enviar modelo</button>
          <button onClick={onClose} className="flex items-center justify-center gap-2 rounded bg-status-danger px-5 py-2 text-[13px] font-medium text-white hover:bg-red-600"><X size={15} /> Cancelar</button>
        </div>
      </div>
    </div>
  );
}
