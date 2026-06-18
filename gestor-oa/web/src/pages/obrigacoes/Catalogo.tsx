import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Landmark, List, Cog, Search, Plus } from 'lucide-react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Modal, Spinner, useToast } from '../../components/ui';
import type { Obrigacao, Departamento, RegraPrazo, Periodicidade } from '../../lib/tipos';
import { LABEL_PERIODICIDADE } from '../../lib/tipos';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Meses de vencimento aplicaveis conforme a periodicidade (representacao).
function mesesAplicaveis(per: Periodicidade): number[] {
  if (per === 'MENSAL') return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  if (per === 'TRIMESTRAL') return [0, 3, 6, 9];
  if (per === 'ANUAL') return [0];
  return []; // EVENTUAL
}

// Rotulo do dia conforme a regra de prazo.
function rotuloDia(regra: RegraPrazo): string {
  if (regra?.tipoDia === 'DIA_UTIL') return `${regra.dia}ºDU`;
  return String(regra?.dia ?? '');
}

// Compet. de referencia (derivado do nosso modelo: vence no mes seguinte a competencia).
function competenciaRef(per: Periodicidade): string {
  if (per === 'ANUAL') return 'Ano anterior';
  if (per === 'EVENTUAL') return 'Eventual';
  return 'Mes anterior';
}

export default function Catalogo() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');

  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroDep, setFiltroDep] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativas' | 'inativas' | 'todas'>('ativas');
  const [editando, setEditando] = useState<Obrigacao | null>(null);
  const [novo, setNovo] = useState(false);
  const [imprimirAberto, setImprimirAberto] = useState(false);
  const imprimirRef = useRef<HTMLDivElement>(null);

  function carregar() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filtroDep) qs.set('departamentoId', filtroDep);
    if (busca.trim()) qs.set('busca', busca.trim());
    api.get<Obrigacao[]>(`/obrigacoes?${qs}`).then(setObrigacoes).finally(() => setLoading(false));
  }
  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
  }, []);
  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroDep, busca]);
  useEffect(() => {
    function fora(e: MouseEvent) { if (imprimirRef.current && !imprimirRef.current.contains(e.target as Node)) setImprimirAberto(false); }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  async function excluir(o: Obrigacao) {
    if (!confirm(`Excluir a obrigacao "${o.nome}"?`)) return;
    try {
      await api.del(`/obrigacoes/${o.id}`);
      toast('ok', 'Obrigacao excluida.');
      carregar();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    }
  }

  async function exportarExcel() {
    setImprimirAberto(false);
    const res = await fetch('/api/v1/obrigacoes/export', {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!res.ok) return toast('erro', 'Falha ao exportar.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'obrigacoes.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const lista = obrigacoes.filter((o) =>
    status === 'todas' ? true : status === 'ativas' ? o.ativo : !o.ativo,
  );

  return (
    <div className="space-y-3">
      {/* Toolbar estilo Acessorias */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar obrigacao" />
        </div>

        <div className="text-sm text-marca-600">{lista.length} reg</div>

        {/* 4 icones */}
        <div className="flex items-center gap-3">
          <div className="relative" ref={imprimirRef}>
            <button title="Imprimir obrigacoes" className="text-marca-600 hover:text-marca-800" onClick={() => setImprimirAberto((v) => !v)}>
              <Printer size={20} />
            </button>
            {imprimirAberto && (
              <div className="absolute left-0 top-7 z-50 flex gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                <button className="rounded bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600" onClick={() => { setImprimirAberto(false); toast('ok', 'Exportacao PDF: em breve'); }}>PDF</button>
                <button className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700" onClick={exportarExcel}>EXCEL</button>
              </div>
            )}
          </div>
          <button title="Configurar regimes tributarios" className="text-marca-600 hover:text-marca-800" onClick={() => navigate('/obrigacoes/regimes')}>
            <Landmark size={20} />
          </button>
          <button title="Grupos de obrigacoes" className="text-marca-600 hover:text-marca-800" onClick={() => navigate('/obrigacoes/grupos')}>
            <List size={20} />
          </button>
          <button title="Configurar feriados" className="text-orange-500 hover:text-orange-600" onClick={() => navigate('/obrigacoes/feriados')}>
            <Cog size={20} />
          </button>
        </div>

        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="ativas">Apenas ativas</option>
          <option value="inativas">Exibir inativas</option>
          <option value="todas">Todas</option>
        </select>
        <select className="input w-48" value={filtroDep} onChange={(e) => setFiltroDep(e.target.value)}>
          <option value="">Todos os departamentos</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>

        {podeGerenciar && (
          <button className="btn-primary" onClick={() => setNovo(true)}><Plus size={16} /> Nova obrigacao</button>
        )}
      </div>

      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Obrigacao / Departamento / Qtde empresas</th>
                <th className="px-3 py-2">Datas para entrega (DU = Dia Util)</th>
                <th className="px-3 py-2">Multa? / Robo?</th>
                <th className="px-3 py-2">Compet. / Lembrar</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => {
                const meses = mesesAplicaveis(o.periodicidade);
                const dia = rotuloDia(o.regraPrazo);
                return (
                  <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                    <td className="px-3 py-2">
                      <button className="text-left font-medium text-marca-700 hover:underline" onClick={() => podeGerenciar && setEditando(o)}>
                        {o.nome} {!o.ativo && <span className="text-red-500">[Inativa]</span>}
                      </button>
                      <div className="text-xs text-slate-500">{o.departamento?.nome ?? '—'}</div>
                      <div className="text-xs text-slate-400">{o._count?.empresaObrigacoes ?? 0} empresas</div>
                    </td>
                    <td className="px-3 py-2">
                      {meses.length === 0 ? (
                        <span className="text-xs text-slate-400">Eventual</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px] text-slate-500">
                          {meses.map((m) => <span key={m}>{dia}/{MESES[m]}</span>)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      <div>Multa? <span className="text-slate-400">—</span></div>
                      <div>Robo? <span className={o.exigeBaixaPeloRobo ? 'text-marca-600' : 'text-slate-400'}>{o.exigeBaixaPeloRobo ? 'Sim' : 'Nao'}</span></div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      <div>{competenciaRef(o.periodicidade)}</div>
                      <div className="text-slate-400">{(o.regraPrazo?.diasAntesTecnico ?? 0)} dias antes</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {podeGerenciar && (
                        <div className="flex justify-end gap-2 text-xs">
                          <button className="text-marca-600 hover:underline" onClick={() => setEditando(o)}>editar</button>
                          <button className="text-red-500 hover:underline" onClick={() => excluir(o)}>excluir</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Nenhuma obrigacao.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {(novo || editando) && (
        <ObrigacaoModal
          departamentos={departamentos}
          obrigacao={editando}
          onFechar={() => { setNovo(false); setEditando(null); }}
          onSalvo={() => { setNovo(false); setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}

const REGRA_PADRAO: RegraPrazo = {
  tipoDia: 'DIA_FIXO',
  dia: 20,
  regraNaoUtil: 'ANTECIPA',
  diasAntesTecnico: 2,
  tipoDiasAntes: 'UTEIS',
};

function ObrigacaoModal({
  departamentos,
  obrigacao,
  onFechar,
  onSalvo,
}: {
  departamentos: Departamento[];
  obrigacao: Obrigacao | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    nome: obrigacao?.nome ?? '',
    departamentoId: obrigacao?.departamentoId ?? '',
    descricao: obrigacao?.descricao ?? '',
    periodicidade: (obrigacao?.periodicidade ?? 'MENSAL') as Periodicidade,
    tempoPrevistoMin: obrigacao?.tempoPrevistoMin ?? 0,
    exigeAnexoNaBaixa: obrigacao?.exigeAnexoNaBaixa ?? false,
    exigeBaixaPeloRobo: obrigacao?.exigeBaixaPeloRobo ?? false,
  });
  const [regra, setRegra] = useState<RegraPrazo>(obrigacao?.regraPrazo ?? REGRA_PADRAO);
  const [salvando, setSalvando] = useState(false);

  function setR<K extends keyof RegraPrazo>(k: K, v: RegraPrazo[K]) {
    setRegra((r) => ({ ...r, [k]: v }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      const payload = {
        ...form,
        departamentoId: form.departamentoId || null,
        descricao: form.descricao || null,
        tempoPrevistoMin: Number(form.tempoPrevistoMin),
        regraPrazo: { ...regra, dia: Number(regra.dia), diasAntesTecnico: Number(regra.diasAntesTecnico) },
      };
      if (obrigacao) await api.put(`/obrigacoes/${obrigacao.id}`, payload);
      else await api.post('/obrigacoes', payload);
      toast('ok', 'Obrigacao salva.');
      onSalvo();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto titulo={obrigacao ? 'Editar obrigacao' : 'Nova obrigacao'} onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome *</label>
            <input className="input" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label">Departamento</label>
            <select className="input" value={form.departamentoId} onChange={(e) => setForm((f) => ({ ...f, departamentoId: e.target.value }))}>
              <option value="">— nenhum —</option>
              {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Periodicidade</label>
            <select className="input" value={form.periodicidade} onChange={(e) => setForm((f) => ({ ...f, periodicidade: e.target.value as Periodicidade }))}>
              {Object.entries(LABEL_PERIODICIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tempo previsto (min)</label>
            <input type="number" className="input" value={form.tempoPrevistoMin} onChange={(e) => setForm((f) => ({ ...f, tempoPrevistoMin: Number(e.target.value) }))} />
          </div>
        </div>

        {/* Regra de prazo */}
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-medium text-slate-600">Regra de prazo</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Tipo de dia</label>
              <select className="input" value={regra.tipoDia} onChange={(e) => setR('tipoDia', e.target.value as RegraPrazo['tipoDia'])}>
                <option value="DIA_FIXO">Dia fixo</option>
                <option value="DIA_UTIL">Dia util (Nº)</option>
              </select>
            </div>
            <div>
              <label className="label">{regra.tipoDia === 'DIA_UTIL' ? 'N-esimo dia util' : 'Dia do mes'}</label>
              <input type="number" className="input" value={regra.dia} onChange={(e) => setR('dia', Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Se cair em dia nao-util</label>
              <select className="input" value={regra.regraNaoUtil} onChange={(e) => setR('regraNaoUtil', e.target.value as RegraPrazo['regraNaoUtil'])} disabled={regra.tipoDia === 'DIA_UTIL'}>
                <option value="ANTECIPA">Antecipa</option>
                <option value="POSTERGA">Posterga</option>
                <option value="MANTEM">Mantem</option>
              </select>
            </div>
            <div>
              <label className="label">Dias antes (tecnico)</label>
              <input type="number" className="input" value={regra.diasAntesTecnico} onChange={(e) => setR('diasAntesTecnico', Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Tipo dias antes</label>
              <select className="input" value={regra.tipoDiasAntes} onChange={(e) => setR('tipoDiasAntes', e.target.value as RegraPrazo['tipoDiasAntes'])}>
                <option value="CORRIDOS">Corridos</option>
                <option value="UTEIS">Uteis</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!regra.sabadoEhUtil} onChange={(e) => setR('sabadoEhUtil', e.target.checked)} />
                Sabado util
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.exigeAnexoNaBaixa} onChange={(e) => setForm((f) => ({ ...f, exigeAnexoNaBaixa: e.target.checked }))} />
            Exige anexo na baixa
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.exigeBaixaPeloRobo} onChange={(e) => setForm((f) => ({ ...f, exigeBaixaPeloRobo: e.target.checked }))} />
            Baixa pelo robo
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}
