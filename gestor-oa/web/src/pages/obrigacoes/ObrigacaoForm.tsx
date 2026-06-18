import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, RotateCcw, History, Building2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useToast, Spinner } from '../../components/ui';
import type { Obrigacao, Departamento, EntregaMes, ModoEntregaMes, CompetenciaRef, RegraPrazo, Periodicidade } from '../../lib/tipos';

interface UsuarioBasico { id: string; nome: string }

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function mesesPadrao(): EntregaMes[] {
  return Array.from({ length: 12 }, () => ({ modo: 'DIA_FIXO' as ModoEntregaMes, dia: 20 }));
}

// Deriva periodicidade e uma regraPrazo representativa (mantem o motor de geracao funcionando).
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

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
  }, []);

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

  function setMes(i: number, patch: Partial<EntregaMes>) {
    setMeses((arr) => arr.map((m, j) => (j === i ? { ...m, ...patch } : m)));
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

  if (carregando) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-500">Obrigacoes › <span className="text-slate-700">Cadastro de obrigacao</span></div>

      {/* Linha 1: Nome / Mininome / Depto+Resp / Tempo */}
      <div className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
        <div className="md:col-span-1">
          <label className="label">Nome da obrigacao</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="label">Mininome</label>
          <input className="input" value={mininome} onChange={(e) => setMininome(e.target.value)} placeholder="Apelido curto" />
        </div>
        <div>
          <label className="label">Departamento e Responsavel</label>
          <div className="flex gap-1">
            <select className="input" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
              <option value="">Depto...</option>
              {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <select className="input" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              <option value="">Resp...</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Tempo previsto (min)</label>
          <input type="number" className="input" value={tempoPrevistoMin} onChange={(e) => setTempo(e.target.value)} />
        </div>
      </div>

      {/* Entrega mes a mes */}
      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Entrega mes a mes</span>
          <button className="text-xs text-marca-600 hover:underline" onClick={aplicarTodos}>aplicar Janeiro a todos os meses</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meses.map((m, i) => (
            <div key={i}>
              <label className="label">Entrega {MESES[i]}</label>
              <div className="flex gap-1">
                <select className="input" value={m.modo} onChange={(e) => setMes(i, { modo: e.target.value as ModoEntregaMes })}>
                  <option value="DIA_FIXO">Todo dia</option>
                  <option value="DIA_UTIL">Nº dia util</option>
                  <option value="ULT_DIA_UTIL">Ultimo dia util</option>
                  <option value="NAO_ENTREGA">Nao entrega</option>
                </select>
                {(m.modo === 'DIA_FIXO' || m.modo === 'DIA_UTIL') && (
                  <input type="number" min={1} max={31} className="input w-20" value={m.dia ?? ''} onChange={(e) => setMes(i, { dia: Number(e.target.value) })} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regras */}
      <div className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className="label">Lembrar quantos dias antes?</label>
          <input type="number" min={0} className="input" value={lembrarDiasAntes} onChange={(e) => setLembrar(e.target.value)} />
        </div>
        <div>
          <label className="label">Tipo dos dias antes</label>
          <select className="input" value={tipoDiasAntes} onChange={(e) => setTipoDiasAntes(e.target.value as RegraPrazo['tipoDiasAntes'])}>
            <option value="CORRIDOS">Dias corridos</option>
            <option value="UTEIS">Dias uteis</option>
          </select>
        </div>
        <div>
          <label className="label">Prazos fixos em dias nao-uteis</label>
          <select className="input" value={regraNaoUtil} onChange={(e) => setRegraNaoUtil(e.target.value as RegraPrazo['regraNaoUtil'])}>
            <option value="ANTECIPA">Antecipar para o dia util anterior</option>
            <option value="POSTERGA">Postergar para o proximo dia util</option>
            <option value="MANTEM">Manter a data</option>
          </select>
        </div>
        <div>
          <label className="label">Sabado e util?</label>
          <select className="input" value={sabadoEhUtil ? 'sim' : 'nao'} onChange={(e) => setSabado(e.target.value === 'sim')}>
            <option value="nao">Nao</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <label className="label">Competencias referentes a</label>
          <select className="input" value={competenciaRef} onChange={(e) => setCompetencia(e.target.value as CompetenciaRef)}>
            <option value="MES_ATUAL">Mes atual</option>
            <option value="MES_ANTERIOR">Mes anterior</option>
            <option value="ANO_ATUAL">Ano atual</option>
            <option value="ANO_ANTERIOR">Ano anterior</option>
          </select>
        </div>
        <div>
          <label className="label">Exigir Robo?</label>
          <select className="input" value={exigeBaixaPeloRobo ? 'sim' : 'nao'} onChange={(e) => setRobo(e.target.value === 'sim')}>
            <option value="nao">Nao</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <label className="label">Passivel de multa?</label>
          <select className="input" value={passivelMulta ? 'sim' : 'nao'} onChange={(e) => setMulta(e.target.value === 'sim')}>
            <option value="nao">Nao</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <label className="label">Alerta guia nao-lida?</label>
          <select className="input" value={alertaNaoLida ? 'sim' : 'nao'} onChange={(e) => setAlerta(e.target.value === 'sim')}>
            <option value="sim">Sim</option>
            <option value="nao">Nao</option>
          </select>
        </div>
        <div>
          <label className="label">Ativa?</label>
          <select className="input" value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}>
            <option value="sim">Sim</option>
            <option value="nao">Nao</option>
          </select>
        </div>
      </div>

      {/* Comentario padrao */}
      <div className="card p-5">
        <label className="label">Comentario Padrao</label>
        <textarea className="input" rows={2} value={comentarioPadrao} onChange={(e) => setComentario(e.target.value)} placeholder="Comentario padrao" />
      </div>

      {/* Acoes */}
      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-primary bg-status-ok hover:bg-emerald-600" disabled={salvando} onClick={() => salvar('voltar')}><Save size={16} /> Salvar</button>
        <button className="btn-primary" disabled={salvando} onClick={() => salvar('nova')}><Plus size={16} /> Nova</button>
        <button className="btn-primary bg-status-warn hover:bg-amber-500" onClick={() => navigate('/obrigacoes')}><RotateCcw size={16} /> Voltar</button>
      </div>

      {!novo && (
        <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-sm">
          <button className="flex items-center gap-1 text-marca-600 hover:underline" onClick={() => navigate('/obrigacoes/alocacao')}>
            <Building2 size={15} /> Empresas que entregam essa obrigacao [{qtdeEmpresas}]
          </button>
          <button className="flex items-center gap-1 text-slate-500 hover:underline" onClick={() => navigate('/auditoria')}>
            <History size={15} /> Log das alteracoes
          </button>
        </div>
      )}
    </div>
  );
}
