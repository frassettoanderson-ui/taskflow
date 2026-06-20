import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type {
  EmpresaDetalhe,
  Tag,
  Departamento,
  UsuarioBasico,
  TipoIdentificador,
  LogAuditoria,
  GrupoEmpresa,
  TarefaAgendada,
  MotivoCancelamento,
} from '../../lib/tipos';
import { LABEL_TIPO_IDENT, formatarIdent, formatarBytes } from '../../lib/tipos';
import AbaObrigacoes from './AbaObrigacoes';
import AbaDocumentos from './AbaDocumentos';
import AbaComunicacao from './AbaComunicacao';

const ABAS = [
  'Dados',
  'Identificadores',
  'Obrigacoes',
  'Contatos',
  'Documentos',
  'Comunicacao',
  'Anexos',
  'Comentarios',
  'Historico',
] as const;
type Aba = (typeof ABAS)[number];

export default function EmpresaFicha() {
  const { id = '' } = useParams();
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeEditar = temPermissao(sessao, 'empresas_editar');
  const podeExcluir = temPermissao(sessao, 'empresas_excluir');

  const [empresa, setEmpresa] = useState<EmpresaDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('Dados');
  const [modalExcluir, setModalExcluir] = useState(false);

  function recarregar() {
    return api
      .get<EmpresaDetalhe>(`/empresas/${id}`)
      .then(setEmpresa)
      .catch((e) => toast('erro', e instanceof ApiError ? e.message : 'Erro'));
  }

  useEffect(() => {
    setLoading(true);
    recarregar().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <Spinner />;
  if (!empresa) return <div className="text-slate-400">Empresa nao encontrada.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => navigate('/empresas')} className="text-sm text-petroleo-600 hover:underline">
            ← Voltar
          </button>
          <h1 className="text-2xl font-semibold text-slate-800">{empresa.razaoSocial}</h1>
          <div className="mt-1 flex items-center gap-2">
            {empresa.ativo ? (
              <Badge className="bg-emerald-100 text-emerald-700">Ativa</Badge>
            ) : (
              <Badge className="bg-slate-200 text-slate-600">Inativa</Badge>
            )}
            {empresa.tags.map((t) => (
              <Badge key={t.tag.id} cor={t.tag.cor}>{t.tag.nome}</Badge>
            ))}
          </div>
        </div>
        {podeExcluir && (
          <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => setModalExcluir(true)}>
            Excluir empresa
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-slate-200 text-sm">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 ${
              aba === a
                ? 'border-b-2 border-petroleo-600 font-medium text-petroleo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {a}
          </button>
        ))}
        {['Processos'].map((a) => (
          <span key={a} className="px-4 py-2 text-slate-300" title="Em breve">{a}</span>
        ))}
      </div>

      {aba === 'Dados' && (
        <AbaDados empresa={empresa} podeEditar={podeEditar} onSalvo={recarregar} />
      )}
      {aba === 'Identificadores' && (
        <AbaIdentificadores empresa={empresa} podeEditar={podeEditar} onMudou={recarregar} />
      )}
      {aba === 'Obrigacoes' && (
        <AbaObrigacoes
          empresaId={empresa.id}
          regimeAtualId={empresa.regimeTributarioId}
          onRegimeMudou={recarregar}
        />
      )}
      {aba === 'Contatos' && (
        <AbaContatos empresa={empresa} podeEditar={podeEditar} onMudou={recarregar} />
      )}
      {aba === 'Documentos' && <AbaDocumentos empresaId={empresa.id} />}
      {aba === 'Comunicacao' && <AbaComunicacao empresaId={empresa.id} />}
      {aba === 'Anexos' && <AbaAnexos empresa={empresa} onMudou={recarregar} />}
      {aba === 'Comentarios' && <AbaComentarios empresa={empresa} onMudou={recarregar} />}
      {aba === 'Historico' && <AbaHistorico empresaId={empresa.id} />}

      {modalExcluir && (
        <ModalExcluir empresa={empresa} onFechar={() => setModalExcluir(false)} onExcluido={() => navigate('/empresas')} />
      )}
    </div>
  );
}

// ---------- Aba Dados ----------
function AbaDados({
  empresa,
  podeEditar,
  onSalvo,
}: {
  empresa: EmpresaDetalhe;
  podeEditar: boolean;
  onSalvo: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    razaoSocial: empresa.razaoSocial,
    nomeFantasia: empresa.nomeFantasia ?? '',
    grupoEmpresaId: empresa.grupoEmpresaId ?? '',
    honorario: empresa.honorario != null ? String(empresa.honorario) : '',
    apelidoEcontinuo: empresa.apelidoEcontinuo ?? '',
    emailPrincipal: empresa.emailPrincipal ?? '',
    telefone: empresa.telefone ?? '',
    cep: empresa.cep ?? '',
    logradouro: empresa.logradouro ?? '',
    numeroEndereco: empresa.numeroEndereco ?? '',
    complemento: empresa.complemento ?? '',
    bairro: empresa.bairro ?? '',
    cidade: empresa.cidade ?? '',
    uf: empresa.uf ?? '',
    grupoEnvio: empresa.grupoEnvio ?? '',
    anotacoes: empresa.anotacoes ?? '',
    ativo: empresa.ativo,
  });
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>(empresa.tags.map((t) => t.tag.id));
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [tarefas, setTarefas] = useState<TarefaAgendada[]>([]);
  const [motivos, setMotivos] = useState<MotivoCancelamento[]>([]);
  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', dataHora: '' });
  const [assistente, setAssistente] = useState(false);

  function carregarTarefas() {
    api.get<TarefaAgendada[]>(`/empresas/${empresa.id}/tarefas`).then(setTarefas).catch(() => undefined);
  }

  useEffect(() => {
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
    api.get<MotivoCancelamento[]>('/motivos-cancelamento').then(setMotivos).catch(() => undefined);
    carregarTarefas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTarefa() {
    if (!novaTarefa.titulo.trim() || !novaTarefa.dataHora) return toast('erro', 'Informe titulo e data/hora.');
    try {
      await api.post(`/empresas/${empresa.id}/tarefas`, { titulo: novaTarefa.titulo.trim(), dataHora: novaTarefa.dataHora });
      setNovaTarefa({ titulo: '', dataHora: '' }); carregarTarefas();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function toggleTarefa(t: TarefaAgendada) {
    try { await api.put(`/empresas/${empresa.id}/tarefas/${t.id}`, { concluida: !t.concluida }); carregarTarefas(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function delTarefa(t: TarefaAgendada) {
    if (!confirm('Remover esta tarefa?')) return;
    try { await api.del(`/empresas/${empresa.id}/tarefas/${t.id}`); carregarTarefas(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api.put(`/empresas/${empresa.id}`, {
        ...form,
        honorario: form.honorario === '' ? null : Number(form.honorario),
        apelidoEcontinuo: form.apelidoEcontinuo || null,
        grupoEmpresaId: form.grupoEmpresaId || null,
        emailPrincipal: form.emailPrincipal || null,
        tagIds,
      });
      toast('ok', 'Dados salvos.');
      onSalvo();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  async function definirResponsavel(departamentoId: string, usuarioId: string) {
    try {
      await api.put(`/empresas/${empresa.id}/responsaveis`, { departamentoId, usuarioId });
      toast('ok', 'Responsavel atualizado.');
      onSalvo();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    }
  }

  const respPorDep = new Map(empresa.responsaveis.map((r) => [r.departamentoId, r.usuarioId]));

  return (
    <>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="card space-y-4 p-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Dados cadastrais</h2>
          <span className="text-sm font-medium text-marca-600">ID: {empresa.numero ?? '—'}</span>
        </div>
        <div>
          <label className="label">Razao social</label>
          <input className="input" value={form.razaoSocial} disabled={!podeEditar} onChange={(e) => set('razaoSocial', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nome fantasia</label>
            <input className="input" value={form.nomeFantasia} disabled={!podeEditar} onChange={(e) => set('nomeFantasia', e.target.value)} />
          </div>
          <div>
            <label className="label">Honorario (R$)</label>
            <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={form.honorario} disabled={!podeEditar} onChange={(e) => set('honorario', e.target.value)} />
          </div>
          <div>
            <label className="label">Apelido e-Continuo <span className="font-normal text-slate-400">(em branco = ID)</span></label>
            <input className="input" value={form.apelidoEcontinuo} disabled={!podeEditar} onChange={(e) => set('apelidoEcontinuo', e.target.value)} />
          </div>
          <div>
            <label className="label">Grupo de empresas</label>
            <select className="input" value={form.grupoEmpresaId} disabled={!podeEditar} onChange={(e) => set('grupoEmpresaId', e.target.value)}>
              <option value="">— Sem grupo —</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">E-mail principal</label>
            <input className="input" value={form.emailPrincipal} disabled={!podeEditar} onChange={(e) => set('emailPrincipal', e.target.value)} />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.telefone} disabled={!podeEditar} onChange={(e) => set('telefone', e.target.value)} />
          </div>
          <div>
            <label className="label">Grupo de envio de e-mails</label>
            <input className="input" value={form.grupoEnvio} disabled={!podeEditar} onChange={(e) => set('grupoEnvio', e.target.value)} placeholder="Ex.: Lote matutino" />
          </div>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-600">Endereco</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><label className="label">CEP</label><input className="input" value={form.cep} disabled={!podeEditar} onChange={(e) => set('cep', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">Logradouro</label><input className="input" value={form.logradouro} disabled={!podeEditar} onChange={(e) => set('logradouro', e.target.value)} /></div>
            <div><label className="label">Numero</label><input className="input" value={form.numeroEndereco} disabled={!podeEditar} onChange={(e) => set('numeroEndereco', e.target.value)} /></div>
            <div><label className="label">Complemento</label><input className="input" value={form.complemento} disabled={!podeEditar} onChange={(e) => set('complemento', e.target.value)} /></div>
            <div><label className="label">Bairro</label><input className="input" value={form.bairro} disabled={!podeEditar} onChange={(e) => set('bairro', e.target.value)} /></div>
            <div><label className="label">Cidade</label><input className="input" value={form.cidade} disabled={!podeEditar} onChange={(e) => set('cidade', e.target.value)} /></div>
            <div><label className="label">UF</label><input className="input" maxLength={2} value={form.uf} disabled={!podeEditar} onChange={(e) => set('uf', e.target.value.toUpperCase())} /></div>
          </div>
        </div>
        <div>
          <label className="label">Anotacoes</label>
          <textarea className="input" rows={3} value={form.anotacoes} disabled={!podeEditar} onChange={(e) => set('anotacoes', e.target.value)} />
        </div>
        {podeEditar && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.ativo} onChange={(e) => set('ativo', e.target.checked)} />
              Empresa ativa
            </label>
            {empresa.ativo && (
              <button type="button" className="text-sm text-status-danger hover:underline" onClick={() => setAssistente(true)}>
                Inativar empresa (assistente)
              </button>
            )}
          </div>
        )}
        {tags.length > 0 && (
          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <label key={t.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    disabled={!podeEditar}
                    checked={tagIds.includes(t.id)}
                    onChange={(e) => setTagIds((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id)))}
                  />
                  {t.nome}
                </label>
              ))}
            </div>
          </div>
        )}
        {podeEditar && (
          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar dados'}
          </button>
        )}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-semibold text-slate-700">Responsaveis por departamento</h2>
        {departamentos.length === 0 && <p className="text-sm text-slate-400">Nenhum departamento cadastrado.</p>}
        {departamentos.map((d) => (
          <div key={d.id}>
            <label className="label flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.cor }} />
              {d.nome}
            </label>
            <select
              className="input"
              disabled={!podeEditar}
              value={respPorDep.get(d.id) ?? ''}
              onChange={(e) => definirResponsavel(d.id, e.target.value)}
            >
              <option value="">— sem responsavel —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
        ))}
      </section>

      {/* Tarefas agendadas */}
      <section className="card space-y-3 p-6 lg:col-span-3">
        <h2 className="font-semibold text-slate-700">Tarefas agendadas</h2>
        {podeEditar && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="label">Tarefa</label>
              <input className="input" value={novaTarefa.titulo} placeholder="Ex.: Ligar para o cliente sobre pendencia" onChange={(e) => setNovaTarefa((t) => ({ ...t, titulo: e.target.value }))} />
            </div>
            <div>
              <label className="label">Data/hora</label>
              <input className="input" type="datetime-local" value={novaTarefa.dataHora} onChange={(e) => setNovaTarefa((t) => ({ ...t, dataHora: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={addTarefa}>+ Agendar</button>
          </div>
        )}
        {tarefas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma tarefa agendada.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tarefas.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <input type="checkbox" checked={t.concluida} disabled={!podeEditar} onChange={() => toggleTarefa(t)} />
                <div className="flex-1">
                  <div className={`text-sm ${t.concluida ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.titulo}</div>
                  <div className="text-xs text-slate-400">{new Date(t.dataHora).toLocaleString('pt-BR')}</div>
                </div>
                {podeEditar && <button className="text-xs text-slate-400 hover:text-red-500" onClick={() => delTarefa(t)}>remover</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    {assistente && (
      <AssistenteInativacao
        empresa={empresa}
        motivos={motivos}
        onFechar={() => setAssistente(false)}
        onFeito={() => { setAssistente(false); onSalvo(); }}
      />
    )}
    </>
  );
}

// ---------- Assistente de inativacao ----------
function AssistenteInativacao({
  empresa, motivos, onFechar, onFeito,
}: { empresa: EmpresaDetalhe; motivos: MotivoCancelamento[]; onFechar: () => void; onFeito: () => void }) {
  const toast = useToast();
  const [motivoId, setMotivoId] = useState('');
  const [dataSaida, setDataSaida] = useState(new Date().toISOString().slice(0, 10));
  const [dispensarPendentes, setDispensarPendentes] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    if (!window.confirm(`Inativar "${empresa.razaoSocial}"? Esta acao pode ser revertida reativando a empresa.`)) return;
    setSalvando(true);
    try {
      const r = await api.post<{ demandasDispensadas: number }>(`/empresas/${empresa.id}/inativar-assistido`, {
        motivoCancelamentoId: motivoId || undefined,
        dataSaida: dataSaida || undefined,
        dispensarPendentes,
        observacao: observacao || undefined,
      });
      toast('ok', `Empresa inativada.${r.demandasDispensadas ? ` ${r.demandasDispensadas} demanda(s) pendente(s) dispensada(s).` : ''}`);
      onFeito();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Assistente de inativacao da empresa" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-[13px] text-slate-500">Siga os passos para inativar a empresa de forma organizada.</p>
        <div>
          <label className="label">1. Motivo do cancelamento</label>
          <select className="input" value={motivoId} onChange={(e) => setMotivoId(e.target.value)}>
            <option value="">— Selecione —</option>
            {motivos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          {motivos.length === 0 && <p className="mt-1 text-xs text-slate-400">Nenhum motivo cadastrado (Sistema &rsaquo; Motivos de cancelamento).</p>}
        </div>
        <div>
          <label className="label">2. Data de saida</label>
          <input className="input" type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} />
        </div>
        <div>
          <label className="label">3. Pendencias</label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={dispensarPendentes} onChange={(e) => setDispensarPendentes(e.target.checked)} />
            Dispensar as demandas pendentes na Lista de Entregas
          </label>
        </div>
        <div>
          <label className="label">Observacao (opcional)</label>
          <textarea className="input" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary bg-status-danger hover:bg-red-600" onClick={confirmar} disabled={salvando}>
            {salvando ? 'Inativando...' : 'Inativar empresa'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Aba Identificadores ----------
function AbaIdentificadores({
  empresa,
  podeEditar,
  onMudou,
}: {
  empresa: EmpresaDetalhe;
  podeEditar: boolean;
  onMudou: () => void;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoIdentificador>('CNPJ');
  const [valor, setValor] = useState('');
  const [apelido, setApelido] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!valor.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/empresas/${empresa.id}/identificadores`, { tipo, valor, apelido: apelido || undefined });
      setValor(''); setApelido('');
      toast('ok', 'Identificador adicionado.');
      onMudou();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(identId: string) {
    try {
      await api.del(`/empresas/${empresa.id}/identificadores/${identId}`);
      toast('ok', 'Removido.');
      onMudou();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <tr><th className="py-2">Tipo</th><th>Valor</th><th>Apelido</th><th></th></tr>
        </thead>
        <tbody>
          {empresa.identificadores.map((i) => (
            <tr key={i.id} className="border-b border-slate-100">
              <td className="py-2">{LABEL_TIPO_IDENT[i.tipo]}</td>
              <td className="font-mono">{formatarIdent(i.tipo, i.valor)}</td>
              <td className="text-slate-500">{i.apelido ?? '—'}</td>
              <td className="text-right">
                {podeEditar && (
                  <button className="text-red-500 hover:underline" onClick={() => remover(i.id)}>remover</button>
                )}
              </td>
            </tr>
          ))}
          {empresa.identificadores.length === 0 && (
            <tr><td colSpan={4} className="py-4 text-center text-slate-400">Nenhum identificador.</td></tr>
          )}
        </tbody>
      </table>

      {podeEditar && (
        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <select className="input w-44" value={tipo} onChange={(e) => setTipo(e.target.value as TipoIdentificador)}>
            {Object.entries(LABEL_TIPO_IDENT).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
          <input className="input flex-1" placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
          <input className="input w-40" placeholder="Apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} />
          <button className="btn-primary" onClick={adicionar} disabled={salvando}>Adicionar</button>
        </div>
      )}
    </div>
  );
}

// ---------- Aba Contatos ----------
function AbaContatos({
  empresa,
  podeEditar,
  onMudou,
}: {
  empresa: EmpresaDetalhe;
  podeEditar: boolean;
  onMudou: () => void;
}) {
  const toast = useToast();
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
  }, []);

  async function remover(contatoId: string) {
    try {
      await api.del(`/empresas/${empresa.id}/contatos/${contatoId}`);
      toast('ok', 'Contato removido.');
      onMudou();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    }
  }

  return (
    <div className="space-y-3">
      {empresa.contatos.map((c) => (
        <div key={c.id} className="card flex items-center justify-between p-4">
          <div>
            <div className="font-medium text-slate-700">{c.nome} {c.cargo && <span className="text-xs text-slate-400">· {c.cargo}</span>}</div>
            <div className="text-sm text-slate-500">{c.email ?? 'sem e-mail'} {c.whatsapp && `· ${c.whatsapp}`}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {c.departamentoIds.map((depId) => {
                const d = departamentos.find((x) => x.id === depId);
                return d ? <Badge key={depId} cor={d.cor}>{d.nome}</Badge> : null;
              })}
            </div>
          </div>
          {podeEditar && (
            <div className="flex gap-2 text-sm">
              <button
                className="text-marca-600 hover:underline"
                onClick={async () => {
                  try {
                    const r = await api.post<{ link: string }>(`/empresas/${empresa.id}/contatos/${c.id}/convidar`);
                    toast('ok', 'Convite enviado.');
                    navigator.clipboard?.writeText(r.link).catch(() => undefined);
                  } catch (e) {
                    toast('erro', e instanceof ApiError ? e.message : 'Erro');
                  }
                }}
              >
                convidar p/ portal
              </button>
              <button
                className="text-emerald-600 hover:underline"
                onClick={async () => {
                  try {
                    const r = await api.post<{ email: string; senha: string }>(`/empresas/${empresa.id}/contatos/${c.id}/ativar-acesso`, {});
                    toast('ok', `Acesso ativado. Login: ${r.email} / senha: ${r.senha}`);
                  } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
                }}
              >
                ativar acesso
              </button>
              <button className="text-petroleo-600 hover:underline" onClick={() => setEditando(c.id)}>editar</button>
              <button className="text-red-500 hover:underline" onClick={() => remover(c.id)}>remover</button>
            </div>
          )}
        </div>
      ))}
      {empresa.contatos.length === 0 && <p className="text-slate-400">Nenhum contato cadastrado.</p>}

      {podeEditar && !novo && (
        <button className="btn-ghost border border-slate-300" onClick={() => setNovo(true)}>+ Novo contato</button>
      )}

      {(novo || editando) && (
        <ContatoForm
          empresaId={empresa.id}
          departamentos={departamentos}
          contato={editando ? empresa.contatos.find((c) => c.id === editando) : undefined}
          onFechar={() => { setNovo(false); setEditando(null); }}
          onSalvo={() => { setNovo(false); setEditando(null); onMudou(); }}
        />
      )}
    </div>
  );
}

function ContatoForm({
  empresaId,
  departamentos,
  contato,
  onFechar,
  onSalvo,
}: {
  empresaId: string;
  departamentos: Departamento[];
  contato?: EmpresaDetalhe['contatos'][number];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    nome: contato?.nome ?? '',
    email: contato?.email ?? '',
    whatsapp: contato?.whatsapp ?? '',
    cargo: contato?.cargo ?? '',
  });
  const [depIds, setDepIds] = useState<string[]>(contato?.departamentoIds ?? []);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const payload = { ...form, email: form.email || null, departamentoIds: depIds };
      if (contato) await api.put(`/empresas/${empresaId}/contatos/${contato.id}`, payload);
      else await api.post(`/empresas/${empresaId}/contatos`, payload);
      toast('ok', 'Contato salvo.');
      onSalvo();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto titulo={contato ? 'Editar contato' : 'Novo contato'} onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Nome *</label><input className="input" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">E-mail</label><input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">WhatsApp</label><input className="input" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} /></div>
        </div>
        <div><label className="label">Cargo</label><input className="input" value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} /></div>
        <div>
          <label className="label">Departamentos liberados (Area VIP)</label>
          <div className="flex flex-wrap gap-2">
            {departamentos.map((d) => (
              <label key={d.id} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={depIds.includes(d.id)} onChange={(e) => setDepIds((ids) => (e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id)))} />
                {d.nome}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Aba Anexos ----------
function AbaAnexos({ empresa, onMudou }: { empresa: EmpresaDetalhe; onMudou: () => void }) {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeUpload = temPermissao(sessao, 'documentos_upload');
  const podeExcluir = temPermissao(sessao, 'documentos_excluir');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('arquivos', f));
    setEnviando(true);
    try {
      await api.upload(`/empresas/${empresa.id}/anexos`, fd);
      toast('ok', 'Anexos enviados.');
      onMudou();
    } catch (err) {
      toast('erro', err instanceof ApiError ? err.message : 'Erro');
    } finally {
      setEnviando(false);
    }
  }

  async function baixar(anexoId: string, nome: string) {
    const res = await fetch(`/api/v1/empresas/${empresa.id}/anexos/${anexoId}/download`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!res.ok) return toast('erro', 'Falha no download.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url);
  }

  async function remover(anexoId: string) {
    try {
      await api.del(`/empresas/${empresa.id}/anexos/${anexoId}`);
      toast('ok', 'Anexo removido.');
      onMudou();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    }
  }

  return (
    <div className="card space-y-3 p-6">
      {podeUpload && (
        <div>
          <input type="file" multiple onChange={enviar} disabled={enviando} />
          {enviando && <span className="ml-2 text-sm text-slate-400">enviando...</span>}
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {empresa.anexos.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <button className="text-petroleo-600 hover:underline" onClick={() => baixar(a.id, a.nomeArquivo)}>{a.nomeArquivo}</button>
              <span className="ml-2 text-xs text-slate-400">{formatarBytes(a.tamanho)}</span>
            </div>
            {podeExcluir && <button className="text-red-500 hover:underline" onClick={() => remover(a.id)}>remover</button>}
          </div>
        ))}
        {empresa.anexos.length === 0 && <p className="py-4 text-center text-slate-400">Nenhum anexo.</p>}
      </div>
    </div>
  );
}

// ---------- Aba Comentarios ----------
function AbaComentarios({ empresa, onMudou }: { empresa: EmpresaDetalhe; onMudou: () => void }) {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [departamentoId, setDepartamentoId] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
  }, []);

  async function adicionar() {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/empresas/${empresa.id}/comentarios`, { texto, departamentoId: departamentoId || null });
      setTexto('');
      toast('ok', 'Comentario adicionado.');
      onMudou();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <textarea className="input" rows={3} placeholder="Anotacao interna..." value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="flex items-center gap-2">
          <select className="input w-56" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
            <option value="">Sem departamento</option>
            {departamentos.map((d) => (<option key={d.id} value={d.id}>{d.nome}</option>))}
          </select>
          <button className="btn-primary" onClick={adicionar} disabled={salvando}>Comentar</button>
        </div>
      </div>
      <div className="space-y-2">
        {empresa.comentarios.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
              {c.departamento && <Badge cor={c.departamento.cor}>{c.departamento.nome}</Badge>}
              {new Date(c.createdAt).toLocaleString('pt-BR')}
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{c.texto}</p>
          </div>
        ))}
        {empresa.comentarios.length === 0 && <p className="text-slate-400">Nenhum comentario.</p>}
      </div>
    </div>
  );
}

// ---------- Aba Historico ----------
function AbaHistorico({ empresaId }: { empresaId: string }) {
  const [logs, setLogs] = useState<LogAuditoria[] | null>(null);
  useEffect(() => {
    api.get<LogAuditoria[]>(`/empresas/${empresaId}/historico`).then(setLogs).catch(() => setLogs([]));
  }, [empresaId]);

  if (!logs) return <Spinner />;
  return (
    <div className="card divide-y divide-slate-100 p-2">
      {logs.map((l) => (
        <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <Badge className={l.acao === 'CREATE' ? 'bg-emerald-100 text-emerald-700' : l.acao === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{l.acao}</Badge>
          <span className="text-slate-600">{l.usuario?.nome ?? 'Sistema'}</span>
          <span className="ml-auto text-xs text-slate-400">{new Date(l.createdAt).toLocaleString('pt-BR')}</span>
        </div>
      ))}
      {logs.length === 0 && <p className="py-4 text-center text-slate-400">Sem registros.</p>}
    </div>
  );
}

// ---------- Modal Excluir ----------
function ModalExcluir({ empresa, onFechar, onExcluido }: { empresa: EmpresaDetalhe; onFechar: () => void; onExcluido: () => void }) {
  const toast = useToast();
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      await api.del(`/empresas/${empresa.id}?confirmacao=${encodeURIComponent(confirmacao)}`);
      toast('ok', 'Empresa excluida.');
      onExcluido();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Modal aberto titulo="Excluir empresa" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Esta acao e' irreversivel. Para confirmar, digite a razao social exatamente:
        </p>
        <p className="rounded bg-slate-100 px-3 py-2 font-mono text-sm">{empresa.razaoSocial}</p>
        <input className="input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="Digite para confirmar" />
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button
            className="btn bg-red-600 text-white hover:bg-red-700"
            disabled={excluindo || confirmacao !== empresa.razaoSocial}
            onClick={excluir}
          >
            {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
