import { useEffect, useState } from 'react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type { Obrigacao, Departamento, RegraPrazo, Periodicidade } from '../../lib/tipos';
import { LABEL_PERIODICIDADE, descreverRegra } from '../../lib/tipos';

export default function Catalogo() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');

  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroDep, setFiltroDep] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Obrigacao | null>(null);
  const [novo, setNovo] = useState(false);

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

  async function exportar() {
    const res = await fetch('/api/v1/obrigacoes/export', {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!res.ok) return toast('erro', 'Falha ao exportar.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'obrigacoes_por_regime.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Catalogo de Obrigacoes</h1>
        <div className="flex gap-2">
          <button className="btn-ghost border border-slate-300" onClick={exportar}>Exportar CSV</button>
          {podeGerenciar && <button className="btn-primary" onClick={() => setNovo(true)}>+ Nova obrigacao</button>}
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Buscar</label>
          <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome da obrigacao..." />
        </div>
        <div>
          <label className="label">Departamento</label>
          <select className="input" value={filtroDep} onChange={(e) => setFiltroDep(e.target.value)}>
            <option value="">Todos</option>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Obrigacao</th>
                <th className="px-3 py-2">Departamento</th>
                <th className="px-3 py-2">Periodicidade</th>
                <th className="px-3 py-2">Prazo</th>
                <th className="px-3 py-2">Tempo</th>
                <th className="px-3 py-2">Empresas</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {obrigacoes.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-700">{o.nome}</div>
                    <div className="flex gap-1">
                      {o.exigeAnexoNaBaixa && <span className="text-[10px] text-amber-600">exige anexo</span>}
                      {o.exigeBaixaPeloRobo && <span className="text-[10px] text-marca-600">robo</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {o.departamento ? <Badge cor={o.departamento.cor}>{o.departamento.nome}</Badge> : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{LABEL_PERIODICIDADE[o.periodicidade]}</td>
                  <td className="px-3 py-2 text-slate-500">{descreverRegra(o.regraPrazo)}</td>
                  <td className="px-3 py-2 text-slate-500">{o.tempoPrevistoMin} min</td>
                  <td className="px-3 py-2 text-slate-500">{o._count?.empresaObrigacoes ?? 0}</td>
                  <td className="px-3 py-2 text-right">
                    {podeGerenciar && (
                      <div className="flex justify-end gap-2 text-xs">
                        <button className="text-marca-600 hover:underline" onClick={() => setEditando(o)}>editar</button>
                        <button className="text-red-500 hover:underline" onClick={() => excluir(o)}>excluir</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {obrigacoes.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Nenhuma obrigacao.</td></tr>
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
