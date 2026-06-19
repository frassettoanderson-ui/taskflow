import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Save, RotateCcw, Plus, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { InfoHint, Spinner, useToast } from '../../components/ui';
import type { Matriz, MatrizPasso, Departamento, Obrigacao, AcaoAutomatica } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-2 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 flex items-center gap-1 text-[13px] font-semibold text-slate-700';

const ACOES: { v: AcaoAutomatica; label: string }[] = [
  { v: 'NENHUMA', label: 'Nenhuma' },
  { v: 'CRIAR_TAREFA', label: 'Criar tarefa' },
  { v: 'CRIAR_OBRIGACAO_NA_EMPRESA', label: 'Criar obrigacao na empresa' },
  { v: 'INICIAR_SUBPROCESSO', label: 'Iniciar subprocesso' },
];

const INFO_SUB = 'Marque "Sim" se esta matriz so pode ser usada como SUB-processo (chamada de dentro de outra matriz), nao aparecendo na lista de "Novo processo".';
const INFO_AUTORIZA = 'Se "Sim", ao iniciar um processo desta matriz o sistema exigira uma autorizacao antes de prosseguir.';
const INFO_BARRA = 'Numero de dias a partir do inicio. Apos esse prazo, a barra de evolucao do processo fica VERMELHA (indicando atraso).';

export default function MatrizForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [matrizesDisp, setMatrizesDisp] = useState<Matriz[]>([]);

  const [nome, setNome] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [soSubmatriz, setSoSubmatriz] = useState(false);
  const [pedeAutorizacao, setPedeAutorizacao] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [barraVermelhaDias, setBarraVermelhaDias] = useState(45);
  const [passos, setPassos] = useState<MatrizPasso[]>([]);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
    api.get<Matriz[]>('/matrizes').then(setMatrizesDisp).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (novo) return;
    api.get<Matriz>(`/matrizes/${id}`).then((m) => {
      setNome(m.nome); setDepartamentoId(m.departamentoId ?? '');
      setSoSubmatriz(m.soSubmatriz); setPedeAutorizacao(m.pedeAutorizacao); setAtivo(m.ativo);
      setBarraVermelhaDias(m.barraVermelhaDias ?? 45); setPassos(m.passos ?? []);
    }).catch(() => toast('erro', 'Matriz nao encontrada.')).finally(() => setCarregando(false));
  }, [id, novo]);

  function addPasso() { setPassos((arr) => [...arr, { ordem: arr.length + 1, titulo: '', prazoDias: 0, basePrazo: 'INICIO', bloqueante: false, acaoAutomatica: 'NENHUMA' }]); }
  function setPasso(i: number, patch: Partial<MatrizPasso>) { setPassos((arr) => arr.map((p, j) => (j === i ? { ...p, ...patch } : p))); }
  function removerPasso(i: number) { setPassos((arr) => arr.filter((_, j) => j !== i).map((p, idx) => ({ ...p, ordem: idx + 1 }))); }

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome da matriz.');
    setSalvando(true);
    try {
      const body = {
        nome, departamentoId: departamentoId || null, soSubmatriz, pedeAutorizacao, ativo,
        barraVermelhaDias: Number(barraVermelhaDias),
        ...(novo ? {} : { passos: passos.map((p, i) => ({ ...p, ordem: i + 1, prazoDias: Number(p.prazoDias) })) }),
      };
      if (novo) { const m = await api.post<{ id: string }>('/matrizes', body); toast('ok', 'Matriz criada.'); navigate(`/processos/matrizes/${m.id}`); }
      else { await api.put(`/matrizes/${id}`, body); toast('ok', 'Matriz salva.'); navigate('/processos/matrizes'); }
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
          <label className={LBL}>Nome da matriz de processos</label>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className={LBL}>So sub-matriz? <InfoHint texto={INFO_SUB} /></label>
          <select className={INP} value={soSubmatriz ? 'sim' : 'nao'} onChange={(e) => setSoSubmatriz(e.target.value === 'sim')}>
            <option value="nao">Nao</option><option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <label className={LBL}>Pede autorizacao? <InfoHint texto={INFO_AUTORIZA} /></label>
          <select className={INP} value={pedeAutorizacao ? 'sim' : 'nao'} onChange={(e) => setPedeAutorizacao(e.target.value === 'sim')}>
            <option value="nao">Nao</option><option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <label className={LBL}>Ativo?</label>
          <select className={INP} value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}>
            <option value="sim">Sim</option><option value="nao">Nao</option>
          </select>
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
        <div className="flex items-end gap-3 md:col-span-2">
          <button onClick={salvar} disabled={salvando} className="flex flex-1 items-center justify-center gap-2 rounded bg-status-ok px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={15} /> {salvando ? '...' : 'Salvar'}</button>
          <button onClick={() => navigate('/processos/matrizes')} className="flex flex-1 items-center justify-center gap-2 rounded bg-status-warn px-5 py-2 text-[13px] font-medium text-white hover:bg-amber-500"><RotateCcw size={15} /> Voltar</button>
        </div>
      </div>

      {/* passos (somente na edicao - tela detalhada definitiva vira depois) */}
      {!novo && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-[13px] font-semibold text-slate-700">Passos / Etapas ({passos.length})</span>
            <button onClick={addPasso} className="flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1 text-[12px] text-slate-600 hover:bg-slate-50"><Plus size={13} /> Passo</button>
          </div>
          <div className="space-y-2">
            {passos.map((p, i) => (
              <div key={i} className="space-y-2 rounded border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">#{i + 1}</span>
                  <input className={`${INP} flex-1`} placeholder="Titulo do passo" value={p.titulo} onChange={(e) => setPasso(i, { titulo: e.target.value })} />
                  <button onClick={() => removerPasso(i)} className="text-slate-400 hover:text-status-danger"><X size={15} /></button>
                </div>
                <input className={INP} placeholder="Dica / descricao (opcional)" value={p.descricao ?? ''} onChange={(e) => setPasso(i, { descricao: e.target.value })} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <select className={INP} value={p.departamentoId ?? ''} onChange={(e) => setPasso(i, { departamentoId: e.target.value || null })}>
                    <option value="">Departamento</option>
                    {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                  <input type="number" className={INP} placeholder="Prazo (dias)" value={p.prazoDias} onChange={(e) => setPasso(i, { prazoDias: Number(e.target.value) })} />
                  <select className={INP} value={p.basePrazo} onChange={(e) => setPasso(i, { basePrazo: e.target.value as MatrizPasso['basePrazo'] })}>
                    <option value="INICIO">do inicio</option>
                    <option value="PASSO_ANTERIOR">do passo anterior</option>
                  </select>
                  <label className="flex items-center gap-1 text-[12px] text-slate-600"><input type="checkbox" checked={p.bloqueante} onChange={(e) => setPasso(i, { bloqueante: e.target.checked })} /> bloqueante</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className={INP} value={p.acaoAutomatica} onChange={(e) => setPasso(i, { acaoAutomatica: e.target.value as AcaoAutomatica, acaoRef: null })}>
                    {ACOES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
                  </select>
                  {p.acaoAutomatica === 'CRIAR_OBRIGACAO_NA_EMPRESA' && (
                    <select className={INP} value={p.acaoRef ?? ''} onChange={(e) => setPasso(i, { acaoRef: e.target.value })}>
                      <option value="">Obrigacao...</option>
                      {obrigacoes.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                    </select>
                  )}
                  {p.acaoAutomatica === 'INICIAR_SUBPROCESSO' && (
                    <select className={INP} value={p.acaoRef ?? ''} onChange={(e) => setPasso(i, { acaoRef: e.target.value })}>
                      <option value="">Matriz...</option>
                      {matrizesDisp.filter((m) => m.id !== id).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  )}
                  {p.acaoAutomatica === 'CRIAR_TAREFA' && (
                    <input className={INP} placeholder="Descricao da tarefa" value={p.acaoRef ?? ''} onChange={(e) => setPasso(i, { acaoRef: e.target.value })} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={salvar} disabled={salvando} className="mt-3 flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={15} /> Salvar matriz e passos</button>
        </div>
      )}
    </div>
  );
}
