import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, RotateCcw, History, Building2, RefreshCcw, FilePlus2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useToast, Spinner } from '../../components/ui';
import type { Obrigacao, Departamento, EntregaMes, ModoEntregaMes, CompetenciaRef, RegraPrazo, Periodicidade } from '../../lib/tipos';

interface UsuarioBasico { id: string; nome: string }

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Classes compactas (inputs mais finos / fonte menor) - estilo Acessorias
const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 block text-[12px] font-medium text-slate-600';

function mesesPadrao(): EntregaMes[] {
  return Array.from({ length: 12 }, () => ({ modo: 'DIA_FIXO' as ModoEntregaMes, dia: 20 }));
}

// (de)serializa a entrega do mes num unico valor de <select>
function mesValor(m: EntregaMes): string {
  if (m.modo === 'NAO_ENTREGA') return 'NAO';
  if (m.modo === 'ULT_DIA_UTIL') return 'ULT';
  if (m.modo === 'DIA_UTIL') return `UTIL_${m.dia ?? 1}`;
  return `FIXO_${m.dia ?? 20}`;
}
function parseMes(v: string): EntregaMes {
  if (v === 'NAO') return { modo: 'NAO_ENTREGA' };
  if (v === 'ULT') return { modo: 'ULT_DIA_UTIL' };
  if (v.startsWith('UTIL_')) return { modo: 'DIA_UTIL', dia: Number(v.slice(5)) };
  return { modo: 'DIA_FIXO', dia: Number(v.slice(5)) };
}

function derivar(meses: EntregaMes[], base: { regraNaoUtil: RegraPrazo['regraNaoUtil']; tipoDiasAntes: RegraPrazo['tipoDiasAntes']; sabadoEhUtil: boolean; lembrarDiasAntes: number }) {
  const ativos = meses.filter((m) => m.modo !== 'NAO_ENTREGA');
  const periodicidade: Periodicidade = ativos.length >= 12 ? 'MENSAL' : ativos.length === 0 ? 'EVENTUAL' : ativos.length <= 1 ? 'ANUAL' : ativos.length <= 4 ? 'TRIMESTRAL' : 'MENSAL';
  const rep = ativos[0] ?? { modo: 'DIA_FIXO' as ModoEntregaMes, dia: 20 };
  const regraPrazo: RegraPrazo = {
    tipoDia: rep.modo === 'DIA_FIXO' ? 'DIA_FIXO' : 'DIA_UTIL',
    dia: rep.modo === 'ULT_DIA_UTIL' ? 31 : (rep.dia ?? 20),
    regraNaoUtil: base.regraNaoUtil,
    sabadoEhUtil: base.sabadoEhUtil,
    diasAntesTecnico: base.lembrarDiasAntes,
    tipoDiasAntes: base.tipoDiasAntes,
  };
  return { periodicidade, regraPrazo };
}

export default function ObrigacaoForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [qtdeEmpresas, setQtdeEmpresas] = useState(0);

  const [nome, setNome] = useState('');
  const [mininome, setMininome] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [tempoPrevistoMin, setTempo] = useState('0');
  const [meses, setMeses] = useState<EntregaMes[]>(mesesPadrao());
  const [lembrarDiasAntes, setLembrar] = useState('5');
  const [tipoDiasAntes, setTipoDiasAntes] = useState<RegraPrazo['tipoDiasAntes']>('CORRIDOS');
  const [regraNaoUtil, setRegraNaoUtil] = useState<RegraPrazo['regraNaoUtil']>('ANTECIPA');
  const [sabadoEhUtil, setSabado] = useState(false);
  const [competenciaRef, setCompetencia] = useState<CompetenciaRef>('MES_ATUAL');
  const [exigeBaixaPeloRobo, setRobo] = useState(false);
  const [passivelMulta, setMulta] = useState(false);
  const [alertaNaoLida, setAlerta] = useState(true);
  const [ativo, setAtivo] = useState(true);
  const [comentarioPadrao, setComentario] = useState('');

  // painel "Retro" (geracao retroativa)
  const [retroAberto, setRetroAberto] = useState(false);
  const [retroData, setRetroData] = useState(`${new Date().getFullYear()}-01-01`);
  const [retroForcar, setRetroForcar] = useState(false);
  const [retroLoading, setRetroLoading] = useState(false);

  // painel "Avulsa" (uma empresa, intervalo de competencias)
  const ymAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [avulsaAberto, setAvulsaAberto] = useState(false);
  const [avulsaEmpresaId, setAvulsaEmpresaId] = useState('');
  const [avulsaInicio, setAvulsaInicio] = useState(ymAtual);
  const [avulsaFim, setAvulsaFim] = useState(ymAtual);
  const [avulsaLoading, setAvulsaLoading] = useState(false);

  // painel "Adicionar empresa a essa obrigacao"
  const [addAberto, setAddAberto] = useState(false);
  const [addEmpresaId, setAddEmpresaId] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
  }, []);

  async function adicionarEmpresa() {
    if (!addEmpresaId) return toast('erro', 'Escolha a empresa.');
    setAddLoading(true);
    try {
      await api.post(`/empresa-obrigacoes/empresa/${addEmpresaId}/manual`, { obrigacaoId: id });
      toast('ok', 'Empresa adicionada a essa obrigacao.');
      setQtdeEmpresas((n) => n + 1);
      setAddAberto(false); setAddEmpresaId('');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao adicionar.'); }
    finally { setAddLoading(false); }
  }

  useEffect(() => {
    if (novo) return;
    api.get<Obrigacao>(`/obrigacoes/${id}`).then((o) => {
      setNome(o.nome); setMininome(o.mininome ?? ''); setDepartamentoId(o.departamentoId ?? '');
      setResponsavelId(o.responsavelId ?? ''); setTempo(String(o.tempoPrevistoMin));
      setMeses(Array.isArray(o.entregaMeses) && o.entregaMeses.length === 12 ? o.entregaMeses : mesesPadrao());
      setLembrar(String(o.lembrarDiasAntes ?? 5));
      setTipoDiasAntes(o.regraPrazo?.tipoDiasAntes ?? 'CORRIDOS');
      setRegraNaoUtil(o.regraPrazo?.regraNaoUtil ?? 'ANTECIPA');
      setSabado(!!o.regraPrazo?.sabadoEhUtil);
      setCompetencia(o.competenciaRef ?? 'MES_ANTERIOR');
      setRobo(o.exigeBaixaPeloRobo); setMulta(o.passivelMulta); setAlerta(o.alertaNaoLida); setAtivo(o.ativo);
      setComentario(o.comentarioPadrao ?? '');
      setQtdeEmpresas(o._count?.empresaObrigacoes ?? 0);
    }).catch(() => toast('erro', 'Obrigacao nao encontrada.')).finally(() => setCarregando(false));
  }, [id, novo]);

  function setMes(i: number, m: EntregaMes) {
    setMeses((arr) => arr.map((x, j) => (j === i ? m : x)));
  }
  function aplicarTodos() {
    setMeses((arr) => arr.map(() => ({ ...arr[0] })));
    toast('ok', 'Aplicado a todos os meses.');
  }

  async function salvar(depois: 'voltar' | 'nova') {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome da obrigacao.');
    setSalvando(true);
    try {
      const { periodicidade, regraPrazo } = derivar(meses, { regraNaoUtil, tipoDiasAntes, sabadoEhUtil, lembrarDiasAntes: Number(lembrarDiasAntes) || 0 });
      const payload = {
        nome, mininome: mininome || null, departamentoId: departamentoId || null, responsavelId: responsavelId || null,
        tempoPrevistoMin: Number(tempoPrevistoMin) || 0, entregaMeses: meses, periodicidade, regraPrazo,
        lembrarDiasAntes: Number(lembrarDiasAntes) || 0, competenciaRef,
        exigeBaixaPeloRobo, passivelMulta, alertaNaoLida, ativo, comentarioPadrao: comentarioPadrao || null,
      };
      if (novo) await api.post('/obrigacoes', payload);
      else await api.put(`/obrigacoes/${id}`, payload);
      toast('ok', 'Obrigacao salva.');
      if (depois === 'nova') navigate(0);
      else navigate('/obrigacoes');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  async function gerarRetro() {
    if (!retroData) return toast('erro', 'Informe a data inicial.');
    setRetroLoading(true);
    try {
      const r = await api.post<{ criadas: number; reativadas: number }>(`/obrigacoes/${id}/retro`, {
        dataInicial: retroData, forcarDispensados: retroForcar,
      });
      toast('ok', `${r.criadas} pendencia(s) gerada(s)${retroForcar ? `, ${r.reativadas} reativada(s)` : ''}.`);
      setRetroAberto(false);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao gerar.'); }
    finally { setRetroLoading(false); }
  }

  async function gerarAvulsa() {
    if (!avulsaEmpresaId) return toast('erro', 'Escolha a empresa.');
    if (!avulsaInicio || !avulsaFim) return toast('erro', 'Informe os prazos inicial e final.');
    const [ai, ami] = avulsaInicio.split('-').map(Number);
    const [af, amf] = avulsaFim.split('-').map(Number);
    setAvulsaLoading(true);
    try {
      const r = await api.post<{ criadas: number; reativadas: number }>(`/obrigacoes/${id}/avulsa`, {
        empresaId: avulsaEmpresaId, inicio: { ano: ai, mes: ami }, fim: { ano: af, mes: amf },
      });
      toast('ok', `${r.criadas} demanda(s) gerada(s)${r.reativadas ? `, ${r.reativadas} reativada(s)` : ''}.`);
      setAvulsaAberto(false);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao gerar.'); }
    finally { setAvulsaLoading(false); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-neutral-100 p-5 text-[13px]">
      {/* Linha 1 */}
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-4">
        <div>
          <label className={LBL}>Nome da obrigacao</label>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className={LBL}>Mininome</label>
          <input className={INP} value={mininome} onChange={(e) => setMininome(e.target.value)} placeholder="Apelido curto" />
        </div>
        <div>
          <label className={LBL}>Departamento e Responsavel</label>
          <select
            className={INP}
            value={departamentoId}
            onChange={(e) => {
              const dep = departamentos.find((d) => d.id === e.target.value);
              setDepartamentoId(e.target.value);
              setResponsavelId(dep?.responsavelId ?? '');
            }}
          >
            <option value="">— selecione —</option>
            {departamentos.map((d) => {
              const resp = usuarios.find((u) => u.id === d.responsavelId)?.nome;
              return <option key={d.id} value={d.id}>{d.nome}{resp ? ` - ${resp}` : ' - (sem responsavel)'}</option>;
            })}
          </select>
        </div>
        <div>
          <label className={LBL}>Tempo previsto (min)</label>
          <input type="number" className={INP} value={tempoPrevistoMin} onChange={(e) => setTempo(e.target.value)} />
        </div>
      </div>

      {/* Entrega mes a mes - 6 colunas, dropdown unico por mes */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-slate-600">Entrega mes a mes</span>
          <button className="text-[11px] text-marca-600 hover:underline" onClick={aplicarTodos}>aplicar Janeiro a todos</button>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          {meses.map((m, i) => (
            <div key={i}>
              <label className={LBL}>Entrega {MESES[i]}</label>
              <select className={INP} value={mesValor(m)} onChange={(e) => setMes(i, parseMes(e.target.value))}>
                <option value="NAO">Nao entrega</option>
                <optgroup label="Dia fixo">
                  {Array.from({ length: 31 }, (_, k) => k + 1).map((d) => (
                    <option key={`f${d}`} value={`FIXO_${d}`}>Todo dia {String(d).padStart(2, '0')}</option>
                  ))}
                </optgroup>
                <optgroup label="Dia util">
                  {Array.from({ length: 20 }, (_, k) => k + 1).map((d) => (
                    <option key={`u${d}`} value={`UTIL_${d}`}>{d}o dia util</option>
                  ))}
                  <option value="ULT">Ultimo dia util</option>
                </optgroup>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Regras - linha 1 */}
      <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={LBL}>Lembrar responsavel quantos dias antes?</label>
          <select className={INP} value={lembrarDiasAntes} onChange={(e) => setLembrar(e.target.value)}>
            {Array.from({ length: 31 }, (_, k) => k).map((d) => <option key={d} value={d}>{d} dias antes</option>)}
          </select>
        </div>
        <div>
          <label className={LBL}>Tipo dos dias antes</label>
          <select className={INP} value={tipoDiasAntes} onChange={(e) => setTipoDiasAntes(e.target.value as RegraPrazo['tipoDiasAntes'])}>
            <option value="CORRIDOS">Dias corridos</option>
            <option value="UTEIS">Dias uteis</option>
          </select>
        </div>
        <div>
          <label className={LBL}>Prazos fixos em dias nao-uteis</label>
          <select className={INP} value={regraNaoUtil} onChange={(e) => setRegraNaoUtil(e.target.value as RegraPrazo['regraNaoUtil'])}>
            <option value="ANTECIPA">Antecipar para o dia util anterior</option>
            <option value="POSTERGA">Postergar para o proximo dia util</option>
            <option value="MANTEM">Manter a data</option>
          </select>
        </div>
        <div>
          <label className={LBL}>Sabado e util?</label>
          <select className={INP} value={sabadoEhUtil ? 'sim' : 'nao'} onChange={(e) => setSabado(e.target.value === 'sim')}>
            <option value="nao">Nao</option>
            <option value="sim">Sim</option>
          </select>
        </div>
      </div>

      {/* Regras - linha 2 */}
      <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className={LBL}>Competencias referentes a</label>
          <select className={INP} value={competenciaRef} onChange={(e) => setCompetencia(e.target.value as CompetenciaRef)}>
            <option value="MES_ATUAL">Mes atual</option>
            <option value="MES_ANTERIOR">Mes anterior</option>
            <option value="ANO_ATUAL">Ano atual</option>
            <option value="ANO_ANTERIOR">Ano anterior</option>
          </select>
        </div>
        <div>
          <label className={LBL}>Exigir Robo?</label>
          <select className={INP} value={exigeBaixaPeloRobo ? 'sim' : 'nao'} onChange={(e) => setRobo(e.target.value === 'sim')}>
            <option value="nao">Nao</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <label className={LBL}>Passivel de multa?</label>
          <select className={INP} value={passivelMulta ? 'sim' : 'nao'} onChange={(e) => setMulta(e.target.value === 'sim')}>
            <option value="nao">Nao</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <label className={LBL}>Alerta guia nao-lida?</label>
          <select className={INP} value={alertaNaoLida ? 'sim' : 'nao'} onChange={(e) => setAlerta(e.target.value === 'sim')}>
            <option value="sim">Sim</option>
            <option value="nao">Nao</option>
          </select>
        </div>
        <div>
          <label className={LBL}>Ativa?</label>
          <select className={INP} value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}>
            <option value="sim">Sim</option>
            <option value="nao">Nao</option>
          </select>
        </div>
      </div>

      {/* Comentario padrao */}
      <div className="mt-4 max-w-xl">
        <label className={LBL}>Comentario Padrao</label>
        <textarea className={INP} rows={2} value={comentarioPadrao} onChange={(e) => setComentario(e.target.value)} placeholder="Comentario padrao" />
      </div>

      {/* Acoes */}
      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">
        <button className="flex items-center justify-center gap-2 rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50" disabled={novo} title={novo ? 'Salve a obrigacao primeiro' : ''} onClick={() => setRetroAberto((v) => !v)}>
          <RefreshCcw size={16} /> Retro
        </button>
        <button className="flex items-center justify-center gap-2 rounded-md bg-sky-400 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50" disabled={novo} title={novo ? 'Salve a obrigacao primeiro' : ''} onClick={() => setAvulsaAberto((v) => !v)}>
          <FilePlus2 size={16} /> Avulsa
        </button>
        <button className="flex items-center justify-center gap-2 rounded-md bg-status-ok px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50" disabled={salvando} onClick={() => salvar('voltar')}>
          <Save size={16} /> Salvar
        </button>
        <button className="flex items-center justify-center gap-2 rounded-md bg-marca-500 px-4 py-2 text-sm font-medium text-white hover:bg-marca-600 disabled:opacity-50" disabled={salvando} onClick={() => salvar('nova')}>
          <Plus size={16} /> Nova
        </button>
        <button className="flex items-center justify-center gap-2 rounded-md bg-status-warn px-4 py-2 text-sm font-medium text-white hover:bg-amber-500" onClick={() => navigate('/obrigacoes')}>
          <RotateCcw size={16} /> Voltar
        </button>
      </div>

      {/* Painel Retro (geracao retroativa) */}
      {retroAberto && !novo && (
        <div className="mt-3 rounded-md border border-violet-200 bg-violet-50 p-3">
          <label className="mb-2 flex items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" checked={retroForcar} onChange={(e) => setRetroForcar(e.target.checked)} />
            Forcar status de prazos <span className="font-medium text-slate-500">Dispensados</span> para <span className="font-medium text-marca-600">Pendentes</span>
          </label>
          <div className="mb-1 text-[12px] font-medium text-violet-700">Data retroativa inicial para gerar as pendencias dessa obrigacao:</div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className={`${INP} w-44`} value={retroData} onChange={(e) => setRetroData(e.target.value)} />
            <button className="flex items-center gap-2 rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600 disabled:opacity-50" disabled={retroLoading} onClick={gerarRetro}>
              👍 {retroLoading ? 'Gerando...' : 'OK - Gerar'}
            </button>
            <button className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500" onClick={() => setRetroAberto(false)}>
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Painel Avulsa (uma empresa, intervalo de competencias) */}
      {avulsaAberto && !novo && (
        <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-0.5 block text-[12px] font-medium text-sky-700">Prazo inicial</label>
              <input type="month" className={`${INP} w-44`} value={avulsaInicio} onChange={(e) => setAvulsaInicio(e.target.value)} />
            </div>
            <div>
              <label className="mb-0.5 block text-[12px] font-medium text-sky-700">Prazo final</label>
              <input type="month" className={`${INP} w-44`} value={avulsaFim} onChange={(e) => setAvulsaFim(e.target.value)} />
            </div>
          </div>
          <div className="mt-2">
            <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Empresa a gerar demanda avulsa</label>
            <EmpresaAutocomplete placeholder="Empresa a criar demanda avulsa..." onSelecionar={(e) => setAvulsaEmpresaId(e?.id ?? "")} />
          </div>
          <div className="mt-2 space-y-0.5 text-[11px]">
            <div className="text-red-600">Obs1: meses que ja tem demandas nao serao gerados</div>
            <div className="text-red-600">Obs2: meses com demandas dispensadas voltarao para pendentes</div>
            <div className="text-red-600">Obs3: Se nao tiver dia definido no cadastro, sera considerado dia 15</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="flex items-center gap-2 rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600 disabled:opacity-50" disabled={avulsaLoading} onClick={gerarAvulsa}>
              👍 {avulsaLoading ? 'Gerando...' : 'OK - Gerar'}
            </button>
            <button className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500" onClick={() => setAvulsaAberto(false)}>
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {!novo && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button className="flex items-center gap-1 text-marca-600 hover:underline" onClick={() => navigate('/obrigacoes/alocacao')}>
              <Building2 size={15} /> Empresas que precisam entregar essa obrigacao [{qtdeEmpresas}]
            </button>
            <button className="flex items-center gap-1 font-medium text-marca-600 hover:underline" onClick={() => setAddAberto((v) => !v)}>
              <Plus size={15} /> Adicionar empresa a essa obrigacao
            </button>
          </div>

          {addAberto && (
            <div className="rounded-md border border-marca-200 bg-marca-50 p-3">
              <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Indique a Empresa para adicionar essa obrigacao</label>
              <EmpresaAutocomplete placeholder="Nome da empresa a adicionar essa obrigacao" onSelecionar={(e) => setAddEmpresaId(e?.id ?? "")} />
              <div className="mt-2 flex gap-2">
                <button className="flex items-center gap-2 rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600 disabled:opacity-50" disabled={addLoading} onClick={adicionarEmpresa}>
                  <Plus size={15} /> {addLoading ? 'Adicionando...' : 'Adicionar empresa'}
                </button>
                <button className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500" onClick={() => { setAddAberto(false); setAddEmpresaId(''); }}>
                  ✕ Cancelar
                </button>
              </div>
            </div>
          )}

          <button className="flex items-center gap-1 text-slate-500 hover:underline" onClick={() => navigate('/auditoria')}>
            <History size={15} /> Log das alteracoes
          </button>
        </div>
      )}
    </div>
  );
}

interface EmpresaSel { id: string; razaoSocial: string; nomeFantasia: string | null; cnpj: string | null }

// Barra de pesquisa de empresa (autocomplete) reutilizavel.
function EmpresaAutocomplete({ placeholder, onSelecionar }: { placeholder: string; onSelecionar: (e: EmpresaSel | null) => void }) {
  const [busca, setBusca] = useState('');
  const [res, setRes] = useState<EmpresaSel[]>([]);
  const [aberta, setAberta] = useState(false);
  const [escolhida, setEscolhida] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buscar(t: string) {
    setBusca(t);
    if (escolhida) { setEscolhida(false); onSelecionar(null); }
    if (timer.current) clearTimeout(timer.current);
    if (t.trim().length < 1) { setRes([]); setAberta(false); return; }
    timer.current = setTimeout(() => {
      api.get<{ items: EmpresaSel[] }>(`/empresas?busca=${encodeURIComponent(t.trim())}&limit=15`)
        .then((p) => { setRes(p.items); setAberta(true); })
        .catch(() => undefined);
    }, 300);
  }
  function escolher(e: EmpresaSel) {
    setBusca(e.razaoSocial); setAberta(false); setEscolhida(true); onSelecionar(e);
  }

  return (
    <div className="relative">
      <input
        className={INP}
        value={busca}
        placeholder={placeholder}
        onChange={(e) => buscar(e.target.value)}
        onFocus={() => res.length && setAberta(true)}
      />
      {aberta && res.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {res.map((e) => (
            <button
              key={e.id}
              className="block w-full border-b border-slate-50 px-3 py-1.5 text-left text-[12px] text-slate-600 last:border-0 hover:bg-marca-50"
              onClick={() => escolher(e)}
            >
              {e.cnpj && <span className="text-slate-400">{e.cnpj} · </span>}
              <span className="font-medium text-slate-700">{e.razaoSocial}</span>
              {e.nomeFantasia && <span className="text-slate-400"> [{e.nomeFantasia}]</span>}
            </button>
          ))}
        </div>
      )}
      {escolhida && <div className="mt-0.5 text-[11px] text-emerald-600">Empresa selecionada.</div>}
    </div>
  );
}
