import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Heart, Search, Save, RotateCcw, Lock, Pencil, Trash2, Eye, EyeOff, RefreshCw, Info, CalendarDays,
  MapPin, MessageCircle, Tag as TagIcon, CheckSquare, Users, List, LayoutTemplate, CheckCircle2,
  MessagesSquare, Network, Paperclip, Plus,
} from 'lucide-react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type {
  EmpresaDetalhe, Tag, Departamento, UsuarioBasico, GrupoEmpresa, TarefaAgendada, Regime,
} from '../../lib/tipos';
import { formatarIdent, formatarBytes } from '../../lib/tipos';
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
  { key: 'recorrentes', icon: RefreshCw, titulo: 'Processos recorrentes' },
  { key: 'solicitacoes', icon: MessagesSquare, titulo: 'Solicitacoes' },
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
  const [abertas, setAbertas] = useState<Set<SecaoKey>>(new Set(['endereco']));

  // dados auxiliares
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);

  // form do topo
  const [verHonorario, setVerHonorario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    razaoSocial: '', nomeFantasia: '', apelidoEcontinuo: '', grupoEmpresaId: '',
    honorario: '', regimeTributarioId: '', ativo: true,
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
      });
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

  function toggle(k: SecaoKey) {
    setAbertas((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

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
        tagIds,
      });
      toast('ok', 'Empresa salva.');
      recarregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
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
        <div className="flex items-center gap-3">
          {podeExcluir && <button onClick={excluir} className="text-[12px] font-medium text-status-danger hover:underline">Excluir empresa</button>}
          <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400"><Search size={13} /><span className="text-[12px]">Central de ajuda</span></div>
        </div>
      </div>

      {/* Linha 1: CNPJ / Regime / Grupo / Honorario / ID */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.7fr]">
        <div>
          <div className="flex items-center justify-between"><label className={LBL}>CNPJ / CPF / CAEPF</label><Lock size={14} className="text-amber-500" /></div>
          <input className={`${INP} bg-slate-100`} value={cnpjFmt} readOnly placeholder="Sem identificador" />
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Regime tributario</label>
            <button title="Cadastro de regimes" onClick={() => navigate('/obrigacoes/regimes')} className="text-marca-500 hover:text-marca-700"><Pencil size={13} /></button>
            <button title="Remover regime" onClick={() => set('regimeTributarioId', '')} className="ml-auto text-status-danger hover:text-red-700"><Trash2 size={14} /></button>
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
          <div className="flex items-center gap-2"><label className={LBL}>ID Empresa</label><RefreshCw size={13} className="text-marca-400" /></div>
          <input className={`${INP} bg-slate-100`} value={empresa.numero ?? ''} readOnly />
        </div>
      </div>

      {/* Linha 2: Razao Social / Ativa / Nome Fantasia / Apelido */}
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.6fr_0.6fr_1.2fr_1fr]">
        <div><label className={LBL}>Razao Social</label><input className={INP} value={form.razaoSocial} disabled={!podeEditar} onChange={(e) => set('razaoSocial', e.target.value)} /></div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Ativa?</label><CalendarDays size={13} className="text-status-danger" /></div>
          <select className={INP} value={form.ativo ? 'sim' : 'nao'} disabled={!podeEditar} onChange={(e) => set('ativo', e.target.value === 'sim')}><option value="sim">Sim</option><option value="nao">Nao</option></select>
        </div>
        <div><label className={LBL}>Nome Fantasia</label><input className={INP} value={form.nomeFantasia} disabled={!podeEditar} onChange={(e) => set('nomeFantasia', e.target.value)} /></div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Apelido e-Continuo</label><Info size={13} className="text-marca-400" /></div>
          <input className={INP} value={form.apelidoEcontinuo} disabled={!podeEditar} onChange={(e) => set('apelidoEcontinuo', e.target.value)} />
        </div>
      </div>

      {/* Faixa de icones + Salvar/Voltar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[13px] text-slate-600">Selecione a secao desejada para exibir/ocultar:</p>
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
    </div>
  );
}

// ---------- Caixa colapsavel ----------
function SecaoBox({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded bg-white p-3 shadow-sm">
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
    case 'anexos': return <SecAnexos empresa={empresa} onMudou={onMudou} />;
    case 'gruposEnvio': return <SecGruposEnvio />;
    default: return <p className="text-[12px] text-slate-400">Em construcao (aguardando layout).</p>;
  }
}

// 1 - Endereco e inscricoes
function SecEndereco({ empresa, podeEditar, onMudou }: { empresa: EmpresaDetalhe; podeEditar: boolean; onMudou: () => void }) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    logradouro: empresa.logradouro ?? '', numeroEndereco: empresa.numeroEndereco ?? '', complemento: empresa.complemento ?? '',
    cep: empresa.cep ?? '', bairro: empresa.bairro ?? '', cidade: empresa.cidade ?? '', uf: empresa.uf ?? '', telefone: empresa.telefone ?? '',
  });
  function s<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((x) => ({ ...x, [k]: v })); }
  async function salvar() {
    setSalvando(true);
    try { await api.put(`/empresas/${empresa.id}`, f); toast('ok', 'Endereco salvo.'); onMudou(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_0.7fr_1fr_1fr]">
        <div><label className={LBL}>Endereco</label><input className={INP} value={f.logradouro} disabled={!podeEditar} onChange={(e) => s('logradouro', e.target.value)} /></div>
        <div><label className={LBL}>Numero</label><input className={INP} value={f.numeroEndereco} disabled={!podeEditar} onChange={(e) => s('numeroEndereco', e.target.value)} /></div>
        <div><label className={LBL}>Complemento</label><input className={INP} value={f.complemento} disabled={!podeEditar} onChange={(e) => s('complemento', e.target.value)} /></div>
        <div><label className={LBL}>CEP</label><input className={INP} value={f.cep} disabled={!podeEditar} onChange={(e) => s('cep', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1.5fr_0.5fr_1fr]">
        <div><label className={LBL}>Bairro</label><input className={INP} value={f.bairro} disabled={!podeEditar} onChange={(e) => s('bairro', e.target.value)} /></div>
        <div><label className={LBL}>Cidade</label><input className={INP} value={f.cidade} disabled={!podeEditar} onChange={(e) => s('cidade', e.target.value)} /></div>
        <div><label className={LBL}>UF</label><input className={INP} maxLength={2} value={f.uf} disabled={!podeEditar} onChange={(e) => s('uf', e.target.value.toUpperCase())} /></div>
        <div><label className={LBL}>Fone(s)</label><input className={INP} value={f.telefone} disabled={!podeEditar} onChange={(e) => s('telefone', e.target.value)} /></div>
      </div>
      <p className="text-[12px] text-slate-400">Inscricoes Estaduais, NIRE, Insc. Municipal e Website: em construcao (aguardando ajuste do modelo).</p>
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
          <button onClick={adicionar} className="flex items-center gap-2 rounded bg-marca-500 px-4 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={15} /> Adicionar</button>
        </div>
      )}
      {empresa.contatos.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-1.5">
          <div className={`${INP} min-w-[160px] flex-1 bg-fundo`}>{c.nome}</div>
          <div className={`${INP} min-w-[120px] flex-1 bg-fundo`}>{c.cargo ?? ''}</div>
          <div className={`${INP} min-w-[120px] flex-1 bg-fundo`}>{c.whatsapp ?? ''}</div>
          <div className={`${INP} min-w-[160px] flex-1 bg-fundo`}>{c.email ?? ''}</div>
          {podeEditar && <>
            <button className={`${ICO} bg-status-warn hover:bg-amber-500`} title="Editar"><Pencil size={15} /></button>
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {departamentos.map((d) => (
        <div key={d.id}>
          <label className="mb-1 flex items-center gap-2 text-[13px] font-bold text-slate-700"><span className="inline-block h-2 w-2 rounded-full" style={{ background: d.cor }} />{d.nome}</label>
          <select className={INP} disabled={!podeEditar} value={respPorDep.get(d.id) ?? ''} onChange={(e) => definir(d.id, e.target.value)}>
            <option value="">— sem responsavel —</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      ))}
      {departamentos.length === 0 && <p className="text-[12px] text-slate-400">Nenhum departamento.</p>}
    </div>
  );
}

// 12 - Arquivos anexos
function SecAnexos({ empresa, onMudou }: { empresa: EmpresaDetalhe; onMudou: () => void }) {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeUpload = temPermissao(sessao, 'documentos_upload');
  const podeExcluir = temPermissao(sessao, 'documentos_excluir');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files?.length) return;
    const fd = new FormData(); Array.from(files).forEach((f) => fd.append('arquivos', f));
    setEnviando(true);
    try { await api.upload(`/empresas/${empresa.id}/anexos`, fd); toast('ok', 'Anexos enviados.'); onMudou(); }
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
    <div className="space-y-2">
      {podeUpload && <input type="file" multiple onChange={enviar} disabled={enviando} className="text-[12px]" />}
      <div className="divide-y divide-slate-100">
        {empresa.anexos.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2 text-[13px]">
            <button className="text-marca-600 hover:underline" onClick={() => baixar(a.id, a.nomeArquivo)}>{a.nomeArquivo}</button>
            <div className="flex items-center gap-3"><span className="text-[12px] text-slate-400">{formatarBytes(a.tamanho)}</span>{podeExcluir && <button onClick={() => remover(a.id)} className="text-status-danger hover:text-red-700"><Trash2 size={14} /></button>}</div>
          </div>
        ))}
        {empresa.anexos.length === 0 && <p className="py-2 text-center text-[12px] text-slate-400">Nenhum anexo.</p>}
      </div>
    </div>
  );
}
