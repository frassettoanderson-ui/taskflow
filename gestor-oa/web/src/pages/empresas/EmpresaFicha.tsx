import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Heart, Search, Save, RotateCcw, Lock, Unlock, Pencil, Trash2, Eye, EyeOff, RefreshCw, Info, CalendarDays, ChevronDown,
  MapPin, MessageCircle, Tag as TagIcon, CheckSquare, Users, List, LayoutTemplate, CheckCircle2,
  MessagesSquare, Network, Paperclip, Plus, Smartphone, History,
} from 'lucide-react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type {
  EmpresaDetalhe, Tag, Departamento, UsuarioBasico, GrupoEmpresa, TarefaAgendada, Regime,
} from '../../lib/tipos';
import { formatarIdent, formatarBytes, LABEL_TIPO_IDENT } from '../../lib/tipos';
import AbaObrigacoes from './AbaObrigacoes';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 block text-[13px] font-bold text-slate-700';

// As 12 secoes da ficha, na ordem/icones do original
type SecaoKey = 'endereco' | 'comentarios' | 'tags' | 'processos' | 'contatos' | 'obrigacoes' | 'gruposEnvio' | 'tarefas' | 'recorrentes' | 'solicitacoes' | 'responsaveis' | 'anexos';
const SECOES: { key: SecaoKey; icon: typeof MapPin; titulo: string }[] = [
  { key: 'endereco', icon: MapPin, titulo: 'Endereco e inscricoes' },
  { key: 'comentarios', icon: MessageCircle, titulo: 'Comentarios e anotacoes gerais' },
  { key: 'tags', icon: TagIcon, titulo: 'Tags da empresa' },
  { key: 'processos', icon: CheckSquare, titulo: 'Gestao de Processos' },
  { key: 'contatos', icon: Users, titulo: 'Contatos na empresa' },
  { key: 'obrigacoes', icon: List, titulo: 'Obrigacoes dessa empresa' },
  { key: 'gruposEnvio', icon: LayoutTemplate, titulo: 'Grupo de obrigacoes para envio de e-mails agrupados' },
  { key: 'tarefas', icon: CheckCircle2, titulo: 'Tarefas agendadas' },
  { key: 'recorrentes', icon: RefreshCw, titulo: 'Processos recorrentes dessa empresa' },
  { key: 'solicitacoes', icon: MessagesSquare, titulo: 'Solicitacoes App' },
  { key: 'responsaveis', icon: Network, titulo: 'Responsaveis pelos departamentos' },
  { key: 'anexos', icon: Paperclip, titulo: 'Arquivos anexos' },
];

export default function EmpresaFicha() {
  const { id = '' } = useParams();
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeEditar = temPermissao(sessao, 'empresas_editar');
  const podeExcluir = temPermissao(sessao, 'empresas_excluir');

  const [empresa, setEmpresa] = useState<EmpresaDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  // Secoes abertas: persistidas em localStorage (repete a config na proxima empresa)
  const [abertas, setAbertas] = useState<Set<SecaoKey>>(() => {
    try { const raw = localStorage.getItem('goa.empresa.secoes'); if (raw) return new Set(JSON.parse(raw) as SecaoKey[]); } catch { /* ignore */ }
    return new Set(['endereco']);
  });
  const [tour, setTour] = useState(0); // 0 = fechado, 1..3 = passo do tour de ajuda

  // dados auxiliares
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);

  // form do topo
  const [verHonorario, setVerHonorario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [cnpjDesbloqueado, setCnpjDesbloqueado] = useState(false);
  const [cnpjValor, setCnpjValor] = useState('');
  const [mostrarDatas, setMostrarDatas] = useState(false);
  const [infoApelido, setInfoApelido] = useState(false);
  const [form, setForm] = useState({
    razaoSocial: '', nomeFantasia: '', apelidoEcontinuo: '', grupoEmpresaId: '',
    honorario: '', regimeTributarioId: '', ativo: true,
    dataAbertura: '', dataEntrada: '', dataSaida: '',
  });
  const [tagIds, setTagIds] = useState<string[]>([]);

  function recarregar() {
    return api.get<EmpresaDetalhe>(`/empresas/${id}`).then((e) => {
      setEmpresa(e);
      setForm({
        razaoSocial: e.razaoSocial,
        nomeFantasia: e.nomeFantasia ?? '',
        apelidoEcontinuo: e.apelidoEcontinuo ?? '',
        grupoEmpresaId: e.grupoEmpresaId ?? '',
        honorario: e.honorario != null ? String(e.honorario) : '',
        regimeTributarioId: e.regimeTributarioId ?? '',
        ativo: e.ativo,
        dataAbertura: e.dataAbertura ? e.dataAbertura.slice(0, 10) : '',
        dataEntrada: e.dataEntrada ? e.dataEntrada.slice(0, 10) : '',
        dataSaida: e.dataSaida ? e.dataSaida.slice(0, 10) : '',
      });
      setCnpjValor(e.identificadores.find((i) => i.tipo === 'CNPJ')?.valor ?? '');
      setCnpjDesbloqueado(false);
      setTagIds(e.tags.map((t) => t.tag.id));
    }).catch((err) => toast('erro', err instanceof ApiError ? err.message : 'Erro'));
  }

  useEffect(() => {
    setLoading(true);
    recarregar().finally(() => setLoading(false));
    api.get<Regime[]>('/regimes').then(setRegimes).catch(() => undefined);
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function persist(n: Set<SecaoKey>) { try { localStorage.setItem('goa.empresa.secoes', JSON.stringify([...n])); } catch { /* ignore */ } }
  function toggle(k: SecaoKey) {
    setAbertas((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); persist(n); return n; });
  }
  function toggleTodas() {
    setAbertas((s) => { const n: Set<SecaoKey> = s.size >= SECOES.length ? new Set() : new Set(SECOES.map((x) => x.key)); persist(n); return n; });
  }
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  const isoOuNull = (d: string) => (d ? new Date(d + 'T00:00:00').toISOString() : null);

  async function salvar() {
    if (!empresa) return;
    setSalvando(true);
    try {
      await api.put(`/empresas/${empresa.id}`, {
        razaoSocial: form.razaoSocial,
        nomeFantasia: form.nomeFantasia || null,
        apelidoEcontinuo: form.apelidoEcontinuo || null,
        grupoEmpresaId: form.grupoEmpresaId || null,
        honorario: form.honorario === '' ? null : Number(form.honorario),
        regimeTributarioId: form.regimeTributarioId || null,
        ativo: form.ativo,
        dataAbertura: isoOuNull(form.dataAbertura),
        dataEntrada: isoOuNull(form.dataEntrada),
        dataSaida: isoOuNull(form.dataSaida),
        tagIds,
      });
      // CNPJ (so se destravado e alterado)
      const cnpjAtual = empresa.identificadores.find((i) => i.tipo === 'CNPJ');
      if (cnpjDesbloqueado && cnpjValor.trim() && cnpjValor.trim() !== (cnpjAtual?.valor ?? '')) {
        if (cnpjAtual) await api.del(`/empresas/${empresa.id}/identificadores/${cnpjAtual.id}`);
        await api.post(`/empresas/${empresa.id}/identificadores`, { tipo: 'CNPJ', valor: cnpjValor.trim() });
      }
      toast('ok', 'Empresa salva.');
      recarregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  async function trocarId() {
    if (!empresa) return;
    const atual = empresa.numero != null ? String(empresa.numero) : '';
    const novo = prompt('Trocar ID da empresa:', atual);
    if (novo == null || novo.trim() === '' || novo.trim() === atual) return;
    const n = Number(novo);
    if (!Number.isInteger(n) || n < 0) return toast('erro', 'Informe um numero valido.');
    try { await api.put(`/empresas/${empresa.id}`, { numero: n }); toast('ok', 'ID trocado.'); recarregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao trocar ID.'); }
  }

  async function excluir() {
    if (!empresa || !podeExcluir) return;
    if (!confirm(`Excluir a empresa "${empresa.razaoSocial}"? Acao irreversivel.`)) return;
    try {
      await api.del(`/empresas/${empresa.id}?confirmacao=${encodeURIComponent(empresa.razaoSocial)}`);
      toast('ok', 'Empresa excluida.');
      navigate('/empresas');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao excluir.'); }
  }

  if (loading) return <Spinner />;
  if (!empresa) return <div className="p-6 text-slate-400">Empresa nao encontrada.</div>;

  const cnpj = empresa.identificadores.find((i) => i.tipo === 'CNPJ');
  const cnpjFmt = cnpj ? formatarIdent('CNPJ', cnpj.valor) : '';

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* breadcrumb */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Heart size={16} className="text-slate-400" /><span className="text-slate-300">&rsaquo;</span>
          <span>Empresas</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-700">Cadastro de empresa cliente do escritorio</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400"><Search size={13} /><span className="text-[12px]">Central de ajuda</span></div>
      </div>

      {/* Linha 1: CNPJ / Regime / Grupo / Honorario / ID */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.7fr]">
        <div>
          <div className="flex items-center justify-between"><label className={LBL}>CNPJ / CPF / CAEPF</label>
            {podeEditar && <button title={cnpjDesbloqueado ? 'Bloquear campo do CNPJ' : 'Desbloquear campo do CNPJ'} onClick={() => setCnpjDesbloqueado((v) => !v)}>{cnpjDesbloqueado ? <Unlock size={14} className="text-status-ok" /> : <Lock size={14} className="text-amber-500" />}</button>}
          </div>
          <input className={`${INP} ${cnpjDesbloqueado ? '' : 'bg-slate-100'}`} value={cnpjDesbloqueado ? cnpjValor : cnpjFmt} readOnly={!cnpjDesbloqueado} onChange={(e) => setCnpjValor(e.target.value)} placeholder="Sem identificador" />
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Regime tributario</label>
            <button title="Cadastro de regimes" onClick={() => navigate('/obrigacoes/regimes')} className="text-marca-500 hover:text-marca-700"><Pencil size={13} /></button>
            {podeExcluir && <button title={`Deletar empresa ID [${empresa.numero ?? '-'}]`} onClick={excluir} className="ml-auto text-status-danger hover:text-red-700"><Trash2 size={14} /></button>}
          </div>
          <select className={INP} value={form.regimeTributarioId} disabled={!podeEditar} onChange={(e) => set('regimeTributarioId', e.target.value)}>
            <option value="">— Selecione —</option>
            {regimes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Grupo de empresas</label>
            <button title="Cadastro de grupos" onClick={() => navigate('/empresas/grupos')} className="text-marca-500 hover:text-marca-700"><Pencil size={13} /></button>
          </div>
          <select className={INP} value={form.grupoEmpresaId} disabled={!podeEditar} onChange={(e) => set('grupoEmpresaId', e.target.value)}>
            <option value="">Geral</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Honorario</label>
            <button title="Exibir/ocultar" onClick={() => setVerHonorario((v) => !v)} className="text-marca-500 hover:text-marca-700">{verHonorario ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
          <input className={INP} type={verHonorario ? 'number' : 'password'} step="0.01" min="0" value={form.honorario} disabled={!podeEditar} onChange={(e) => set('honorario', e.target.value)} />
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>ID Empresa</label>
            {podeEditar && <button title="Trocar ID" onClick={trocarId} className="text-status-warn hover:text-amber-600"><RefreshCw size={13} /></button>}
          </div>
          <input className={`${INP} bg-slate-100`} value={empresa.numero ?? ''} readOnly />
        </div>
      </div>

      {/* Linha 2: Razao Social / Ativa / Nome Fantasia / Apelido */}
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.6fr_0.6fr_1.2fr_1fr]">
        <div><label className={LBL}>Razao Social</label><input className={INP} value={form.razaoSocial} disabled={!podeEditar} onChange={(e) => set('razaoSocial', e.target.value)} /></div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Ativa?</label>
            <button title="Exibir/ocultar datas" onClick={() => setMostrarDatas((v) => !v)} className="text-status-danger hover:text-red-700"><CalendarDays size={13} /></button>
          </div>
          <select className={INP} value={form.ativo ? 'sim' : 'nao'} disabled={!podeEditar} onChange={(e) => set('ativo', e.target.value === 'sim')}><option value="sim">Sim</option><option value="nao">Nao</option></select>
        </div>
        <div><label className={LBL}>Nome Fantasia</label><input className={INP} value={form.nomeFantasia} disabled={!podeEditar} onChange={(e) => set('nomeFantasia', e.target.value)} /></div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Apelido e-Continuo</label>
            <button title="Sobre o apelido e-Continuo" onClick={() => setInfoApelido(true)} className="text-marca-400 hover:text-marca-600"><Info size={13} /></button>
          </div>
          <input className={INP} value={form.apelidoEcontinuo} disabled={!podeEditar} onChange={(e) => set('apelidoEcontinuo', e.target.value)} />
        </div>
      </div>

      {/* Datas (exibir/ocultar pelo calendario em Ativa?) */}
      {mostrarDatas && (
        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 rounded bg-white p-3 shadow-sm md:grid-cols-3">
          <div><label className={LBL}>Data abertura</label><input type="date" className={INP} value={form.dataAbertura} disabled={!podeEditar} onChange={(e) => set('dataAbertura', e.target.value)} /></div>
          <div><label className={LBL}>Cliente desde</label><input type="date" className={INP} value={form.dataEntrada} disabled={!podeEditar} onChange={(e) => set('dataEntrada', e.target.value)} /></div>
          <div><label className={LBL}>Cliente ate</label><input type="date" className={INP} value={form.dataSaida} disabled={!podeEditar} onChange={(e) => set('dataSaida', e.target.value)} /></div>
        </div>
      )}

      {/* Faixa de icones + Salvar/Voltar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[13px] text-slate-600">
            Selecione a secao desejada para exibir/ocultar:
            <button title="Ajuda" onClick={() => setTour(1)} className="grid h-4 w-4 place-items-center rounded-full border border-marca-400 text-[10px] text-marca-500 hover:bg-marca-50">?</button>
            <button title="Exibir/ocultar todas" onClick={toggleTodas} className="text-status-ok hover:text-emerald-600"><ChevronDown size={16} /></button>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {SECOES.map(({ key, icon: Icon, titulo }) => (
              <button key={key} title={titulo} onClick={() => toggle(key)} className={`transition-colors ${abertas.has(key) ? 'text-status-ok' : 'text-slate-400 hover:text-slate-600'}`}>
                <Icon size={20} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {empresa.dataEntrada && <span className="self-center text-[12px] font-bold text-slate-600">Cadastro: {new Date(empresa.dataEntrada).toLocaleDateString('pt-BR')}</span>}
          {podeEditar && <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-6 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? '...' : 'Salvar'}</button>}
          <button onClick={() => navigate('/empresas')} className="flex items-center gap-2 rounded-md bg-status-warn px-6 py-2 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      {/* Secoes colapsaveis */}
      <div className="mt-4 space-y-2">
        {SECOES.filter((s) => abertas.has(s.key)).map((s) => (
          <SecaoBox key={s.key} titulo={s.titulo} onFechar={() => toggle(s.key)}>
            <SecaoConteudo
              secao={s.key}
              empresa={empresa}
              podeEditar={podeEditar}
              tags={tags} tagIds={tagIds} setTagIds={setTagIds}
              departamentos={departamentos} usuarios={usuarios}
              onMudou={recarregar}
            />
          </SecaoBox>
        ))}
      </div>

      {/* Tour de ajuda das secoes (3 passos) */}
      {tour > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTour(0)}>
          <div className="max-w-md rounded-lg bg-slate-700 p-5 text-[13px] text-slate-100 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {tour === 1 && <p>Esse e o modo de navegacao nas secoes do cadastro das empresas. Agora as secoes ficarao totalmente ocultas quando estiverem fechadas e podem ser <span className="text-status-ok">exibidas</span>/<span className="text-status-danger">ocultas</span> atraves desses controles.</p>}
            {tour === 2 && <p>Para <span className="text-status-ok">exibir</span>/<span className="text-status-danger">ocultar</span> as secoes, basta clicar nos icones correspondentes. Para saber a qual secao o icone corresponde, basta parar o mouse em cima do controle que o nome aparecera.</p>}
            {tour === 3 && <p>Entao e so clicar nos icones dos controles para <span className="text-status-ok">exibir</span>/<span className="text-status-danger">ocultar</span> a secao desejada! E o mais legal: o Sistema ira <span className="text-marca-300">salvar a ultima opcao</span> que voce utilizou e repetira a configuracao na proxima vez que voce abrir um cadastro de empresa.</p>}
            <div className="mt-4 flex items-center justify-center gap-1 text-slate-400">
              {[1, 2, 3].map((n) => <span key={n} className={`h-2 w-2 rounded-full ${tour === n ? 'bg-white' : 'bg-slate-500'}`} />)}
            </div>
            <div className="mt-3 flex items-center justify-end gap-3">
              <button onClick={() => setTour(0)} className="text-[12px] text-slate-300 hover:text-white">Fechar</button>
              <button disabled={tour === 1} onClick={() => setTour((t) => t - 1)} className="text-[12px] text-slate-300 hover:text-white disabled:opacity-40">Anterior</button>
              {tour < 3
                ? <button onClick={() => setTour((t) => t + 1)} className="rounded border border-slate-400 px-3 py-1 text-[12px] hover:bg-slate-600">Proximo</button>
                : <button onClick={() => setTour(0)} className="rounded border border-slate-400 px-3 py-1 text-[12px] hover:bg-slate-600">OK, entendido</button>}
            </div>
          </div>
        </div>
      )}

      {/* Popup info do Apelido e-Continuo */}
      {infoApelido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setInfoApelido(false)}>
          <div className="max-w-lg rounded-lg bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Info size={40} className="mx-auto mb-3 text-marca-400" />
            <p className="text-[14px] text-slate-600">No robo e-Continuo e (opcionalmente) salvo uma copia do arquivo localmente na maquina do usuario.</p>
            <p className="mt-3 text-[14px] text-slate-600">Essas copias sao organizadas em pastas com o ID dos clientes ou com o <span className="text-status-danger">apelido da empresa</span>.</p>
            <p className="mt-3 text-[14px] text-slate-600">Se deixar o apelido em branco, sera considerado o ID da empresa.</p>
            <button onClick={() => setInfoApelido(false)} className="mt-5 rounded bg-marca-500 px-6 py-1.5 text-sm font-medium text-white hover:bg-marca-600">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Caixa colapsavel ----------
function SecaoBox({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <button onClick={onFechar} className="mb-2 text-left text-[13px] font-bold text-slate-700">
        {titulo} <span className="font-normal text-status-danger">(clique para ocultar)</span>
      </button>
      {children}
    </div>
  );
}

// ---------- Conteudo de cada secao ----------
function SecaoConteudo(props: {
  secao: SecaoKey; empresa: EmpresaDetalhe; podeEditar: boolean;
  tags: Tag[]; tagIds: string[]; setTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  departamentos: Departamento[]; usuarios: UsuarioBasico[]; onMudou: () => void;
}) {
  const { secao, empresa, podeEditar, tags, tagIds, setTagIds, departamentos, usuarios, onMudou } = props;
  switch (secao) {
    case 'endereco': return <SecEndereco empresa={empresa} podeEditar={podeEditar} onMudou={onMudou} />;
    case 'comentarios': return <SecComentarios empresa={empresa} departamentos={departamentos} onMudou={onMudou} />;
    case 'tags': return <SecTags tags={tags} tagIds={tagIds} setTagIds={setTagIds} />;
    case 'contatos': return <SecContatos empresa={empresa} podeEditar={podeEditar} onMudou={onMudou} />;
    case 'obrigacoes': return <AbaObrigacoes empresaId={empresa.id} regimeAtualId={empresa.regimeTributarioId} onRegimeMudou={onMudou} />;
    case 'tarefas': return <SecTarefas empresa={empresa} />;
    case 'responsaveis': return <SecResponsaveis empresa={empresa} departamentos={departamentos} usuarios={usuarios} podeEditar={podeEditar} onMudou={onMudou} />;
    case 'anexos': return <SecAnexos empresa={empresa} departamentos={departamentos} onMudou={onMudou} />;
    case 'gruposEnvio': return <SecGruposEnvio />;
    case 'recorrentes': return <SecRecorrentes empresa={empresa} usuarios={usuarios} podeEditar={podeEditar} />;
    case 'solicitacoes': return <SecSolicitacoes empresa={empresa} />;
    default: return <p className="text-[12px] text-slate-400">Em construcao (aguardando layout).</p>;
  }
}

// Mascaras de campo
const fmtCep = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const fmtFone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 10) return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_m, a, b, c) => [a && `(${a}`, a.length === 2 && ') ', b, c && `-${c}`].filter(Boolean).join(''));
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, (_m, a, b, c) => `(${a}) ${b}${c ? `-${c}` : ''}`);
};
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

interface IE { valor: string; data?: string | null; uf?: string | null }

// 1 - Endereco e inscricoes
function SecEndereco({ empresa, podeEditar, onMudou }: { empresa: EmpresaDetalhe; podeEditar: boolean; onMudou: () => void }) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    logradouro: empresa.logradouro ?? '', numeroEndereco: empresa.numeroEndereco ?? '', complemento: empresa.complemento ?? '',
    cep: empresa.cep ?? '', bairro: empresa.bairro ?? '', cidade: empresa.cidade ?? '', uf: empresa.uf ?? '', telefone: empresa.telefone ?? '',
    nire: empresa.nire ?? '', inscricaoMunicipal: empresa.inscricaoMunicipal ?? '', inscMunicipalData: empresa.inscMunicipalData ?? '', website: empresa.website ?? '',
  });
  const [ieIsenta, setIeIsenta] = useState(empresa.ieIsenta);
  const [ies, setIes] = useState<IE[]>(empresa.inscricoesEstaduais ?? []);
  const [novaIe, setNovaIe] = useState<IE>({ valor: '', data: '', uf: '' });
  // Outros identificadores (reusa o sistema de identificadores, exceto CNPJ)
  const outros = empresa.identificadores.filter((i) => i.tipo !== 'CNPJ');
  const [novoIdent, setNovoIdent] = useState<{ tipo: string; valor: string }>({ tipo: 'CPF', valor: '' });

  function s<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((x) => ({ ...x, [k]: v })); }
  function addIe() { if (!novaIe.valor.trim()) return; setIes((a) => [...a, novaIe]); setNovaIe({ valor: '', data: '', uf: '' }); }
  function rmIe(idx: number) { setIes((a) => a.filter((_, i) => i !== idx)); }

  async function addIdent() {
    if (!novoIdent.valor.trim()) return;
    try { await api.post(`/empresas/${empresa.id}/identificadores`, { tipo: novoIdent.tipo, valor: novoIdent.valor.trim() }); setNovoIdent({ tipo: 'CPF', valor: '' }); toast('ok', 'Identificador adicionado.'); onMudou(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function rmIdent(identId: string) { try { await api.del(`/empresas/${empresa.id}/identificadores/${identId}`); onMudou(); } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); } }

  async function salvar() {
    setSalvando(true);
    try { await api.put(`/empresas/${empresa.id}`, { ...f, ieIsenta, inscricoesEstaduais: ies }); toast('ok', 'Endereco salvo.'); onMudou(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="space-y-3">
      {/* Linha 1: Endereco|Numero / Complemento / CEP / Inscricoes Estaduais */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_1.6fr]">
        <div>
          <label className={LBL}>Endereco | Numero</label>
          <div className="flex gap-2"><input className={INP} value={f.logradouro} disabled={!podeEditar} onChange={(e) => s('logradouro', e.target.value)} /><input className={`${INP} w-20`} value={f.numeroEndereco} disabled={!podeEditar} onChange={(e) => s('numeroEndereco', e.target.value)} /></div>
        </div>
        <div><label className={LBL}>Complemento</label><input className={INP} value={f.complemento} disabled={!podeEditar} onChange={(e) => s('complemento', e.target.value)} /></div>
        <div><label className={LBL}>CEP</label><input className={INP} value={f.cep} disabled={!podeEditar} inputMode="numeric" placeholder="00000-000" onChange={(e) => s('cep', fmtCep(e.target.value))} /></div>
        <div>
          <div className="flex items-center justify-between"><label className={LBL}>Inscricoes Estaduais</label><label className="flex items-center gap-1 text-[12px] text-slate-500"><input type="checkbox" checked={ieIsenta} disabled={!podeEditar} onChange={(e) => setIeIsenta(e.target.checked)} /> Empresa isenta</label></div>
          <div className="flex gap-1">
            <input className={INP} placeholder="Inscricao Estadual" value={novaIe.valor} disabled={!podeEditar || ieIsenta} onChange={(e) => setNovaIe((x) => ({ ...x, valor: e.target.value }))} />
            <input type="date" className={`${INP} w-32`} value={novaIe.data ?? ''} disabled={!podeEditar || ieIsenta} onChange={(e) => setNovaIe((x) => ({ ...x, data: e.target.value }))} />
            <select className={`${INP} w-20`} value={novaIe.uf ?? ''} disabled={!podeEditar || ieIsenta} onChange={(e) => setNovaIe((x) => ({ ...x, uf: e.target.value }))}><option value="">UF</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            <button onClick={addIe} disabled={!podeEditar || ieIsenta} className="grid h-9 w-9 shrink-0 place-items-center rounded bg-marca-500 text-white hover:bg-marca-600 disabled:opacity-40"><Plus size={15} /></button>
          </div>
          {ies.map((ie, i) => (
            <div key={i} className="mt-1 flex items-center gap-2 text-[12px] text-slate-600"><button onClick={() => rmIe(i)} className="text-status-danger">×</button>{ie.valor}{ie.uf ? ` (${ie.uf})` : ''}{ie.data ? ` - ${ie.data}` : ''}</div>
          ))}
        </div>
      </div>

      {/* Linha 2: Bairro / Cidade|UF / NIRE / Outros identificadores */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1.3fr_1fr_1.6fr]">
        <div><label className={LBL}>Bairro</label><input className={INP} value={f.bairro} disabled={!podeEditar} onChange={(e) => s('bairro', e.target.value)} /></div>
        <div>
          <label className={LBL}>Cidade | UF</label>
          <div className="flex gap-2"><input className={INP} value={f.cidade} disabled={!podeEditar} onChange={(e) => s('cidade', e.target.value)} /><input className={`${INP} w-16 text-center`} maxLength={2} value={f.uf} disabled={!podeEditar} onChange={(e) => s('uf', e.target.value.toUpperCase())} /></div>
        </div>
        <div><label className={LBL}>NIRE</label><input className={INP} value={f.nire} disabled={!podeEditar} onChange={(e) => s('nire', e.target.value)} /></div>
        <div>
          <label className={LBL}>Outros identificadores</label>
          <div className="flex gap-1">
            <select className={`${INP} w-24`} value={novoIdent.tipo} disabled={!podeEditar} onChange={(e) => setNovoIdent((x) => ({ ...x, tipo: e.target.value }))}><option value="CPF">CPF</option><option value="CEI">CEI</option><option value="CAEPF">CAEPF</option><option value="INSCRICAO_ESTADUAL">IE</option></select>
            <input className={INP} placeholder="Ex: CPF / CEI" value={novoIdent.valor} disabled={!podeEditar} onChange={(e) => setNovoIdent((x) => ({ ...x, valor: e.target.value }))} />
            <button onClick={addIdent} disabled={!podeEditar} className="grid h-9 w-9 shrink-0 place-items-center rounded bg-marca-500 text-white hover:bg-marca-600 disabled:opacity-40"><Plus size={15} /></button>
          </div>
          {outros.map((o) => (
            <div key={o.id} className="mt-1 flex items-center gap-2 text-[12px] text-slate-600"><button onClick={() => rmIdent(o.id)} className="text-status-danger">×</button>{LABEL_TIPO_IDENT[o.tipo]}: {formatarIdent(o.tipo, o.valor)}</div>
          ))}
        </div>
      </div>

      {/* Linha 3: Fone(s) / Website / Insc. Municipal */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1.6fr_1fr]">
        <div><label className={LBL}>Fone(s)</label><input className={INP} value={f.telefone} disabled={!podeEditar} inputMode="tel" placeholder="(00) 00000-0000" onChange={(e) => s('telefone', fmtFone(e.target.value))} /></div>
        <div><label className={LBL}>Website da empresa</label><input className={INP} value={f.website} disabled={!podeEditar} placeholder="https://" onChange={(e) => s('website', e.target.value)} /></div>
        <div>
          <label className={LBL}>Insc. Municipal</label>
          <div className="flex gap-2"><input className={INP} placeholder="Numero" value={f.inscricaoMunicipal} disabled={!podeEditar} onChange={(e) => s('inscricaoMunicipal', e.target.value)} /><input type="date" className={`${INP} w-32`} value={f.inscMunicipalData} disabled={!podeEditar} onChange={(e) => s('inscMunicipalData', e.target.value)} /></div>
        </div>
      </div>

      {podeEditar && <button onClick={salvar} disabled={salvando} className="rounded bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50">{salvando ? '...' : 'Salvar endereco'}</button>}
    </div>
  );
}

// 2 - Comentarios e anotacoes
function SecComentarios({ empresa, departamentos, onMudou }: { empresa: EmpresaDetalhe; departamentos: Departamento[]; onMudou: () => void }) {
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const [filtroDep, setFiltroDep] = useState('');
  const [novo, setNovo] = useState(false);
  const [texto, setTexto] = useState('');
  const [depNovo, setDepNovo] = useState('');
  async function adicionar() {
    if (!texto.trim()) return;
    try { await api.post(`/empresas/${empresa.id}/comentarios`, { texto, departamentoId: depNovo || null }); setTexto(''); setNovo(false); toast('ok', 'Comentario adicionado.'); onMudou(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  const termo = busca.trim().toLowerCase();
  const lista = empresa.comentarios.filter((c) => (!termo || c.texto.toLowerCase().includes(termo)) && (!filtroDep || c.departamento?.nome === departamentos.find((d) => d.id === filtroDep)?.nome));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${INP} min-w-[240px] flex-1`} placeholder="Comentario/anotacao a procurar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className={`${INP} w-auto`} value={filtroDep} onChange={(e) => setFiltroDep(e.target.value)}><option value="">Todos Dptos</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select>
        <button onClick={() => { setNovo((v) => !v); setDepNovo(filtroDep); }} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600"><Plus size={15} /> Novo</button>
      </div>
      {novo && (
        <div className="flex flex-wrap items-end gap-2 rounded bg-fundo p-2">
          <textarea className={`${INP} min-w-[260px] flex-1`} rows={2} placeholder="Anotacao interna..." value={texto} onChange={(e) => setTexto(e.target.value)} />
          <select className={`${INP} w-auto`} value={depNovo} onChange={(e) => setDepNovo(e.target.value)}><option value="">Sem departamento</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select>
          <button onClick={adicionar} className="rounded bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600">Salvar</button>
        </div>
      )}
      <div className="space-y-1.5">
        {lista.map((c) => (
          <div key={c.id} className={`rounded px-3 py-2 ${'bg-fundo'}`}>
            <div className="mb-0.5 flex items-center gap-2 text-[11px] text-slate-400">
              {c.departamento && <span className="rounded px-1.5 py-0.5 text-white" style={{ background: c.departamento.cor }}>{c.departamento.nome}</span>}
              {new Date(c.createdAt).toLocaleString('pt-BR')}
            </div>
            <p className="whitespace-pre-wrap text-[13px] text-slate-700">{c.texto}</p>
          </div>
        ))}
        {lista.length === 0 && <p className="text-[12px] text-status-danger">Nenhum comentario.</p>}
      </div>
    </div>
  );
}

// 3 - Tags
function SecTags({ tags, tagIds, setTagIds }: { tags: Tag[]; tagIds: string[]; setTagIds: React.Dispatch<React.SetStateAction<string[]>> }) {
  const [txt, setTxt] = useState('');
  const [aberto, setAberto] = useState(false);
  const disp = tags.filter((t) => !tagIds.includes(t.id) && t.nome.toLowerCase().includes(txt.trim().toLowerCase()));
  return (
    <div className="relative">
      <p className="mb-1 text-[12px] text-slate-500">Alteracoes salvas ao clicar em Salvar no topo.</p>
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1.5">
        {tagIds.map((tid) => { const t = tags.find((x) => x.id === tid); return <span key={tid} className="inline-flex items-center gap-1 rounded bg-fundo px-2 py-0.5 text-[12px] text-slate-600"><button onClick={() => setTagIds((a) => a.filter((x) => x !== tid))} className="text-slate-400 hover:text-red-500">×</button>{t?.nome ?? tid}</span>; })}
        <input className="min-w-[120px] flex-1 text-[13px] outline-none" placeholder="Tag's..." value={txt} onChange={(e) => { setTxt(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)} />
      </div>
      {aberto && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {disp.map((t) => <button key={t.id} onMouseDown={() => { setTagIds((a) => [...a, t.id]); setTxt(''); }} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-marca-50">{t.nome}</button>)}
          {disp.length === 0 && <div className="px-3 py-2 text-[12px] text-slate-400">Nenhuma tag.</div>}
        </div>
      )}
    </div>
  );
}

// 5 - Contatos (tabela inline)
function SecContatos({ empresa, podeEditar, onMudou }: { empresa: EmpresaDetalhe; podeEditar: boolean; onMudou: () => void }) {
  const toast = useToast();
  const [novo, setNovo] = useState({ nome: '', cargo: '', whatsapp: '', email: '' });
  async function adicionar() {
    if (!novo.nome.trim()) return toast('erro', 'Informe o nome.');
    try { await api.post(`/empresas/${empresa.id}/contatos`, { ...novo, email: novo.email || null }); setNovo({ nome: '', cargo: '', whatsapp: '', email: '' }); toast('ok', 'Contato adicionado.'); onMudou(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function remover(cid: string) {
    if (!confirm('Remover este contato?')) return;
    try { await api.del(`/empresas/${empresa.id}/contatos/${cid}`); onMudou(); } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  const ICO = 'grid h-9 w-10 place-items-center rounded text-white';
  return (
    <div className="space-y-1.5">
      {podeEditar && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input className={`${INP} min-w-[160px] flex-1`} placeholder="Nome" value={novo.nome} onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))} />
          <input className={`${INP} min-w-[120px] flex-1`} placeholder="Cargo" value={novo.cargo} onChange={(e) => setNovo((n) => ({ ...n, cargo: e.target.value }))} />
          <input className={`${INP} min-w-[120px] flex-1`} placeholder="Celular" value={novo.whatsapp} onChange={(e) => setNovo((n) => ({ ...n, whatsapp: e.target.value }))} />
          <input className={`${INP} min-w-[160px] flex-1`} placeholder="E-Mail" value={novo.email} onChange={(e) => setNovo((n) => ({ ...n, email: e.target.value }))} />
          <button className={`${ICO} bg-roxo-500 hover:bg-roxo-600`} title="Selecionar departamentos"><Network size={15} /></button>
          <button className={`${ICO} bg-marca-400 hover:bg-marca-500`} title="Acesso ao App"><Smartphone size={15} /></button>
          <button onClick={adicionar} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={15} /> Adicionar</button>
        </div>
      )}
      {empresa.contatos.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-1.5">
          <div className={`${INP} min-w-[160px] flex-1 bg-fundo`}>{c.nome}</div>
          <div className={`${INP} min-w-[120px] flex-1 bg-fundo`}>{c.cargo ?? ''}</div>
          <div className={`${INP} min-w-[120px] flex-1 bg-fundo`}>{c.whatsapp ?? ''}</div>
          <div className={`${INP} min-w-[160px] flex-1 bg-fundo`}>{c.email ?? ''}</div>
          <button className={`${ICO} bg-roxo-500 hover:bg-roxo-600`} title="Selecionar departamentos"><Network size={15} /></button>
          <button className={`${ICO} bg-marca-400 hover:bg-marca-500`} title="Acesso ao App"><Smartphone size={15} /></button>
          {podeEditar && <>
            <button className={`${ICO} bg-status-warn hover:bg-amber-500`} title="Editar"><Pencil size={15} /></button>
            <button className={`${ICO} bg-slate-400 hover:bg-slate-500`} title="Log's de alteracao do contato"><History size={15} /></button>
            <button onClick={() => remover(c.id)} className={`${ICO} bg-status-danger hover:bg-red-600`} title="Remover"><Trash2 size={15} /></button>
          </>}
        </div>
      ))}
      {empresa.contatos.length === 0 && <p className="text-[12px] text-slate-400">Nenhum contato.</p>}
    </div>
  );
}

// 7 - Grupos para envio de obrigacoes (placeholder de tabela)
function SecGruposEnvio() {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-200 pb-1 text-[12px] font-bold text-slate-600">
        <span>Nome do grupo</span><span>Remetente</span>
        <button className="text-marca-500 hover:text-marca-700"><Plus size={16} /></button>
      </div>
      <p className="py-3 text-[12px] text-status-danger">Nenhum resultado encontrado.</p>
    </div>
  );
}

// 9 - Processos recorrentes dessa empresa
interface MatrizBasica { id: string; nome: string }
interface RecorrenteItem { id: string; matrizId: string; empresaId: string | null; tipoRecorrencia: string; config: { diasMes?: number[] }; matriz?: { nome: string } }
function SecRecorrentes({ empresa, usuarios, podeEditar }: { empresa: EmpresaDetalhe; usuarios: UsuarioBasico[]; podeEditar: boolean }) {
  const toast = useToast();
  const [matrizes, setMatrizes] = useState<MatrizBasica[]>([]);
  const [itens, setItens] = useState<RecorrenteItem[]>([]);
  const [matrizId, setMatrizId] = useState('');
  const [gestorId, setGestorId] = useState('');
  const [dia, setDia] = useState('');
  const [naoCriaMesAtual, setNaoCriaMesAtual] = useState('nao');
  function carregar() {
    api.get<RecorrenteItem[]>('/processos/recorrencias/lista').then((l) => setItens(l.filter((r) => r.empresaId === empresa.id))).catch(() => undefined);
  }
  useEffect(() => { api.get<MatrizBasica[]>('/matrizes').then(setMatrizes).catch(() => undefined); carregar(); }, [empresa.id]);
  async function adicionar() {
    if (!matrizId || !dia) return toast('erro', 'Selecione o processo e o dia do mes.');
    try {
      await api.post('/processos/recorrencias', { matrizId, empresaId: empresa.id, tipoRecorrencia: 'DIAS_MES', config: { diasMes: [Number(dia)] } });
      setMatrizId(''); setGestorId(''); setDia(''); toast('ok', 'Recorrencia adicionada.'); carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function remover(rid: string) { if (!confirm('Remover recorrencia?')) return; try { await api.del(`/processos/recorrencias/${rid}`); carregar(); } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); } }
  return (
    <div className="space-y-2">
      {podeEditar && (
        <div className="flex flex-wrap items-center gap-1.5">
          <select className={`${INP} min-w-[200px] flex-1`} value={matrizId} onChange={(e) => setMatrizId(e.target.value)}><option value="">Processo...</option>{matrizes.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
          <select className={`${INP} min-w-[180px] flex-1`} value={gestorId} onChange={(e) => setGestorId(e.target.value)} title="Gestor do processo (em construcao)"><option value="">Gestor do processo...</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>
          <select className={`${INP} w-auto`} value={dia} onChange={(e) => setDia(e.target.value)}><option value="">Dia do mes...</option>{Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select>
          <select className={`${INP} w-auto`} value={naoCriaMesAtual} onChange={(e) => setNaoCriaMesAtual(e.target.value)} title="Em construcao"><option value="nao">Nao cria no mes atual</option><option value="sim">Cria no mes atual</option></select>
          <button onClick={adicionar} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={15} /> Adicionar</button>
        </div>
      )}
      {itens.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-1.5">
          <div className={`${INP} min-w-[200px] flex-1 bg-fundo`}>{r.matriz?.nome ?? 'Processo'}</div>
          <div className={`${INP} w-auto bg-fundo`}>Dia {r.config?.diasMes?.join(', ') ?? '—'}</div>
          <button onClick={() => remover(r.id)} className="grid h-9 w-10 place-items-center rounded bg-status-danger text-white hover:bg-red-600"><Trash2 size={15} /></button>
        </div>
      ))}
      {itens.length === 0 && <p className="text-[12px] text-slate-400">Nenhum processo recorrente.</p>}
    </div>
  );
}

// 10 - Solicitacoes App
function SecSolicitacoes({ empresa }: { empresa: EmpresaDetalhe }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-slate-500">As solicitacoes enviadas pelo App/Area VIP desta empresa aparecem aqui.</p>
      <button onClick={() => navigate(`/portal-gestao/solicitacoes?empresa=${empresa.id}`)} className="rounded bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600">Ver solicitacoes da empresa</button>
    </div>
  );
}

// 8 - Tarefas agendadas (usa modelo atual: titulo + data/hora)
function SecTarefas({ empresa }: { empresa: EmpresaDetalhe }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<TarefaAgendada[]>([]);
  const [nova, setNova] = useState({ titulo: '', dataHora: '' });
  function carregar() { api.get<TarefaAgendada[]>(`/empresas/${empresa.id}/tarefas`).then(setTarefas).catch(() => undefined); }
  useEffect(carregar, [empresa.id]);
  async function adicionar() {
    if (!nova.titulo.trim() || !nova.dataHora) return toast('erro', 'Informe descricao e data/hora.');
    try { await api.post(`/empresas/${empresa.id}/tarefas`, { titulo: nova.titulo.trim(), dataHora: nova.dataHora }); setNova({ titulo: '', dataHora: '' }); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function remover(t: TarefaAgendada) { if (!confirm('Remover tarefa?')) return; try { await api.del(`/empresas/${empresa.id}/tarefas/${t.id}`); carregar(); } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); } }
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] text-slate-500">[Gerenciar na <button onClick={() => navigate('/entregas')} className="text-marca-600 hover:underline">Lista de Entregas</button>] — modelo Dia/Mes/Ano/Lembrar: em construcao.</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <input className={`${INP} min-w-[220px] flex-1`} placeholder="Descricao. Ex: Renovar certificado" value={nova.titulo} onChange={(e) => setNova((n) => ({ ...n, titulo: e.target.value }))} />
        <input type="datetime-local" className={`${INP} w-auto`} value={nova.dataHora} onChange={(e) => setNova((n) => ({ ...n, dataHora: e.target.value }))} />
        <button onClick={adicionar} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={15} /> Adicionar</button>
      </div>
      {tarefas.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-1.5">
          <div className={`${INP} min-w-[220px] flex-1 bg-fundo`}>{t.titulo}</div>
          <div className={`${INP} w-auto bg-fundo`}>{new Date(t.dataHora).toLocaleString('pt-BR')}</div>
          <button onClick={() => remover(t)} className="grid h-9 w-10 place-items-center rounded bg-status-danger text-white hover:bg-red-600"><Trash2 size={15} /></button>
        </div>
      ))}
      {tarefas.length === 0 && <p className="text-[12px] text-slate-400">Nenhuma tarefa.</p>}
    </div>
  );
}

// 11 - Responsaveis pelos departamentos
function SecResponsaveis({ empresa, departamentos, usuarios, podeEditar, onMudou }: { empresa: EmpresaDetalhe; departamentos: Departamento[]; usuarios: UsuarioBasico[]; podeEditar: boolean; onMudou: () => void }) {
  const toast = useToast();
  const respPorDep = new Map(empresa.responsaveis.map((r) => [r.departamentoId, r.usuarioId]));
  async function definir(departamentoId: string, usuarioId: string) {
    try { await api.put(`/empresas/${empresa.id}/responsaveis`, { departamentoId, usuarioId }); toast('ok', 'Responsavel atualizado.'); onMudou(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  return (
    <div>
      <div className="grid grid-cols-[1fr_1.4fr] gap-3 border-b border-slate-200 pb-1 text-[13px] font-bold text-slate-700">
        <span className="flex items-center gap-1">Departamento <Pencil size={12} className="text-marca-500" /></span>
        <span>Responsavel padrao</span>
      </div>
      {departamentos.map((d) => (
        <RespLinha key={d.id} dep={d} usuarios={usuarios} valor={respPorDep.get(d.id) ?? ''} podeEditar={podeEditar} onSalvar={(uid) => definir(d.id, uid)} />
      ))}
      {departamentos.length === 0 && <p className="py-2 text-[12px] text-slate-400">Nenhum departamento.</p>}
    </div>
  );
}

function RespLinha({ dep, usuarios, valor, podeEditar, onSalvar }: { dep: Departamento; usuarios: UsuarioBasico[]; valor: string; podeEditar: boolean; onSalvar: (uid: string) => void }) {
  const [editando, setEditando] = useState(false);
  return (
    <div className="grid grid-cols-[1fr_1.4fr] items-center gap-3 border-b border-slate-100 py-1.5">
      <span className="flex items-center gap-2 text-[13px] text-slate-700">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: dep.cor }} />{dep.nome}
        <span className="ml-auto pr-2 text-marca-400" title="Replicar">&raquo;&raquo;&raquo;</span>
      </span>
      <div className="flex items-center gap-1.5">
        <select className={`${INP} ${editando ? '' : 'bg-slate-100 text-slate-500'}`} disabled={!editando} value={valor} onChange={(e) => { onSalvar(e.target.value); }}>
          <option value="">— sem responsavel —</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        {podeEditar && <button onClick={() => setEditando((v) => !v)} className="grid h-9 w-10 place-items-center rounded bg-status-warn text-white hover:bg-amber-500" title="Editar"><Pencil size={15} /></button>}
      </div>
    </div>
  );
}

// 12 - Arquivos anexos
function SecAnexos({ empresa, departamentos, onMudou }: { empresa: EmpresaDetalhe; departamentos: Departamento[]; onMudou: () => void }) {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeUpload = temPermissao(sessao, 'documentos_upload');
  const podeExcluir = temPermissao(sessao, 'documentos_excluir');
  const [enviando, setEnviando] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  async function adicionar() {
    if (!arquivo) return toast('erro', 'Escolha um arquivo.');
    const fd = new FormData(); fd.append('arquivos', arquivo);
    setEnviando(true);
    try { await api.upload(`/empresas/${empresa.id}/anexos`, fd); setArquivo(null); setDescricao(''); toast('ok', 'Arquivo anexado.'); onMudou(); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro'); } finally { setEnviando(false); }
  }
  async function baixar(anexoId: string, nome: string) {
    const res = await fetch(`/api/v1/empresas/${empresa.id}/anexos/${anexoId}/download`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!res.ok) return toast('erro', 'Falha no download.');
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); URL.revokeObjectURL(url);
  }
  async function remover(anexoId: string) { try { await api.del(`/empresas/${empresa.id}/anexos/${anexoId}`); onMudou(); } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); } }
  return (
    <div className="space-y-3">
      {podeUpload && (
        <div className="flex flex-wrap items-end gap-2">
          <input className={`${INP} min-w-[200px] flex-1`} placeholder="Descricao do arquivo a ser anexado(s)..." value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-500">
            <span className="truncate">{arquivo ? arquivo.name : 'Arquivo a ser anexado [ate 60MB]'}</span>
            <span className="ml-auto rounded bg-marca-400 px-2 py-0.5 text-white">Escolher</span>
            <input type="file" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
          <select className={`${INP} w-auto`} value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)} title="Departamento (visual; nao persistido ainda)"><option value="">Departamento</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select>
          <button onClick={adicionar} disabled={enviando} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-2 text-sm font-medium text-white hover:bg-marca-600 disabled:opacity-50"><Plus size={15} /> Adicionar</button>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1 text-[12px] font-bold text-slate-600"><span className="flex items-center gap-1">Departamentos / Arquivos <Search size={13} className="text-marca-500" /></span><span>Qtde</span></div>
      <div className="divide-y divide-slate-100">
        {empresa.anexos.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2 text-[13px]">
            <button className="text-marca-600 hover:underline" onClick={() => baixar(a.id, a.nomeArquivo)}>{a.nomeArquivo}</button>
            <div className="flex items-center gap-3"><span className="text-[12px] text-slate-400">{formatarBytes(a.tamanho)}</span>{podeExcluir && <button onClick={() => remover(a.id)} className="text-status-danger hover:text-red-700"><Trash2 size={14} /></button>}</div>
          </div>
        ))}
        {empresa.anexos.length === 0 && <p className="py-2 text-center text-[12px] text-slate-400">Nenhum arquivo.</p>}
      </div>
    </div>
  );
}
