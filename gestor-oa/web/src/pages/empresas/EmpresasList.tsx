import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Search, SlidersHorizontal, Mail, Download, XCircle, Network, Tags as TagsIcon, Printer, Calendar, Plus, MessageCircle, CheckCircle2, Users, ArrowUpDown, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Spinner, useToast } from '../../components/ui';
import type {
  EmpresaLista,
  EmpresaDetalhe,
  Tag,
  Departamento,
  UsuarioBasico,
  GrupoEmpresa,
  MotivoCancelamento,
} from '../../lib/tipos';
import { formatarIdent } from '../../lib/tipos';
import { SecComentarios, SecContatos, SecTarefas, SecResponsaveis } from './EmpresaFicha';

interface Pagina {
  items: EmpresaLista[];
  page: number;
  totalPages: number;
  total: number;
}

interface ChipF { kind: 'status' | 'grupo' | 'tag' | 'departamento'; valor: string; label: string }

export default function EmpresasList() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeEditar = temPermissao(sessao, 'empresas_editar');
  const podeCriar = temPermissao(sessao, 'empresas_criar');
  const podeImportar = temPermissao(sessao, 'empresas_importar');
  const podeExcluir = temPermissao(sessao, 'empresas_excluir');
  const [searchParams] = useSearchParams();
  const motivoUrl = searchParams.get('motivo') ?? '';
  const grupoUrl = searchParams.get('grupo') ?? '';

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [tagId, setTagId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [grupoId, setGrupoId] = useState(grupoUrl);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [motivos, setMotivos] = useState<MotivoCancelamento[]>([]);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  // combo +Filtros (chips agrupados por Status / Grupo / Tag / Departamento)
  const [comboTxt, setComboTxt] = useState('');
  const [comboAberto, setComboAberto] = useState(false);
  const [chips, setChips] = useState<ChipF[]>([]);
  const [ordenar, setOrdenar] = useState<'razao' | 'fantasia'>('razao');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  // painel inline expandido na linha (comentarios/tarefas/contatos/responsaveis)
  type PainelLinha = 'coment' | 'tarefas' | 'contatos' | 'resp';
  const [expandido, setExpandido] = useState<{ id: string; painel: PainelLinha } | null>(null);
  function togglePainel(id: string, painel: PainelLinha) {
    setExpandido((cur) => (cur && cur.id === id && cur.painel === painel ? null : { id, painel }));
  }
  // barra de acao ativa (so uma por vez; clicar de novo recolhe)
  const [barra, setBarra] = useState<'resp' | 'tags' | 'export' | 'relacao' | 'datas' | null>(null);
  const toggleBarra = (b: 'resp' | 'tags' | 'export' | 'relacao' | 'datas') => setBarra((atual) => (atual === b ? null : b));
  const [respDepto, setRespDepto] = useState('');
  const [respUser, setRespUser] = useState('');
  const [tagsSel, setTagsSel] = useState<string[]>([]);
  const [tagTxt, setTagTxt] = useState('');
  const [tagAberto, setTagAberto] = useState(false);
  const [expDepto, setExpDepto] = useState('');
  const [expBloco, setExpBloco] = useState('50');
  const [expTipo, setExpTipo] = useState<'nomes' | 'enderecos'>('nomes');
  const [datas, setDatas] = useState({ aberturaDe: '', aberturaAte: '', desdeDe: '', desdeAte: '', ateDe: '', ateAte: '' });

  // Carrega filtros auxiliares uma vez
  useEffect(() => {
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
    api.get<MotivoCancelamento[]>('/motivos-cancelamento').then(setMotivos).catch(() => undefined);
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
  }, []);

  // Busca empresas (com debounce simples na busca)
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const qs = new URLSearchParams({
        page: String(page),
        limit: '25',
        status,
      });
      if (busca.trim()) qs.set('busca', busca.trim());
      if (tagId) qs.set('tagId', tagId);
      if (departamentoId) qs.set('departamentoId', departamentoId);
      if (grupoId) qs.set('grupoId', grupoId);
      if (motivoUrl) { qs.set('motivoId', motivoUrl); qs.set('status', 'todos'); }
      api
        .get<Pagina>(`/empresas?${qs.toString()}`)
        .then(setPagina)
        .catch((e) => toast('erro', e instanceof ApiError ? e.message : 'Erro'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [busca, status, tagId, departamentoId, grupoId, motivoUrl, page, refresh, toast]);

  // Reseta pagina ao mudar filtros
  useEffect(() => setPage(1), [busca, status, tagId, departamentoId, grupoId, motivoUrl]);

  const items = pagina?.items ?? [];
  const itensOrdenados = useMemo(() => {
    const campo = ordenar === 'razao' ? 'razaoSocial' : 'nomeFantasia';
    return [...items].sort((a, b) => {
      const va = (a[campo] ?? '').toString().toLowerCase();
      const vb = (b[campo] ?? '').toString().toLowerCase();
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [items, ordenar, dir]);

  async function idsListados(): Promise<string[]> {
    const qs = new URLSearchParams({ page: '1', limit: '10000', status });
    if (busca.trim()) qs.set('busca', busca.trim());
    if (tagId) qs.set('tagId', tagId);
    if (departamentoId) qs.set('departamentoId', departamentoId);
    if (motivoUrl) { qs.set('motivoId', motivoUrl); qs.set('status', 'todos'); }
    const todas = await api.get<Pagina>(`/empresas?${qs}`);
    return todas.items.map((e) => e.id);
  }

  async function adicionarTags() {
    if (!tagsSel.length) return toast('erro', 'Selecione ao menos uma tag.');
    try {
      const ids = await idsListados();
      if (!ids.length) return toast('erro', 'Nenhuma empresa listada.');
      const r = await api.post<{ afetadas: number }>('/empresas/acoes-massa', { empresaIds: ids, acao: 'aplicar_tags', tagIds: tagsSel });
      toast('ok', `${r.afetadas} empresa(s) atualizada(s).`);
      setBarra(null); setTagsSel([]); setBusca((b) => b);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  async function atualizarResponsavel() {
    if (!respDepto || !respUser) return toast('erro', 'Selecione o departamento e o responsavel.');
    try {
      const ids = await idsListados();
      if (!ids.length) return toast('erro', 'Nenhuma empresa listada.');
      const r = await api.post<{ afetadas: number }>('/empresas/acoes-massa', { empresaIds: ids, acao: 'alterar_responsavel', departamentoId: respDepto, usuarioId: respUser });
      toast('ok', `${r.afetadas} empresa(s) atualizada(s).`);
      setBarra(null);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  function ordenarPor(campo: 'razao' | 'fantasia') {
    if (ordenar === campo) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrdenar(campo); setDir('asc'); }
  }

  // Aplica um chip de filtro (so um por tipo; novo do mesmo tipo substitui)
  function addChip(c: ChipF) {
    setChips((cur) => [...cur.filter((x) => x.kind !== c.kind), c]);
    if (c.kind === 'status') setStatus(c.valor as 'ativos' | 'inativos' | 'todos');
    if (c.kind === 'grupo') setGrupoId(c.valor);
    if (c.kind === 'tag') setTagId(c.valor);
    if (c.kind === 'departamento') setDepartamentoId(c.valor);
    setComboTxt(''); setComboAberto(false);
  }
  function removeChip(c: ChipF) {
    setChips((cur) => cur.filter((x) => !(x.kind === c.kind && x.valor === c.valor)));
    if (c.kind === 'status') setStatus('ativos');
    if (c.kind === 'grupo') setGrupoId('');
    if (c.kind === 'tag') setTagId('');
    if (c.kind === 'departamento') setDepartamentoId('');
  }

  async function excluirEmpresa(id: string, razao: string) {
    if (!confirm(`Apagar a empresa "${razao}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await api.del(`/empresas/${id}`);
      toast('ok', 'Empresa apagada.');
      setRefresh((r) => r + 1);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao apagar.'); }
  }

  const ICONE = 'flex h-9 w-9 items-center justify-center rounded hover:opacity-80';

  // opcoes do combo +Filtros (filtradas pelo texto digitado)
  const tq = comboTxt.trim().toLowerCase();
  const optsStatus = ([
    { valor: 'inativos', label: 'Ocultar Ativas' },
    { valor: 'todos', label: 'Exibir Inativas' },
  ] as const).filter((o) => o.label.toLowerCase().includes(tq));
  const optsGrupos = grupos.filter((g) => g.nome.toLowerCase().includes(tq));
  const optsTags = tags.filter((t) => t.nome.toLowerCase().includes(tq));
  const optsDeptos = departamentos.filter((d) => d.nome.toLowerCase().includes(tq));

  return (
    <div className="-m-6 min-h-full bg-fundo p-5 text-[13px]">
      {/* Cabecalho */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Heart size={16} className="text-slate-400" />
          <span className="text-slate-300">›</span>
          <span className="text-slate-700">Empresas clientes do escritorio [F3]</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-400" />
          <input className="w-full rounded border border-marca-300 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-marca-500" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar na relacao" />
        </div>
        <button onClick={() => setMostrarFiltros((v) => !v)} className="flex items-center gap-2 rounded bg-roxo-300 px-4 py-2 text-sm font-medium text-white hover:bg-roxo-400"><SlidersHorizontal size={15} /> +Filtros</button>

        <div className="flex items-center gap-1">
          <button title="Exporta e-mails em bloco" onClick={() => toggleBarra('export')} className={`${ICONE} bg-status-ok/15 text-status-ok`}><Mail size={18} /></button>
          {podeImportar && <button title="Importar cadastros" onClick={() => navigate('/empresas/importar')} className={`${ICONE} bg-marca-100 text-marca-600`}><Download size={18} /></button>}
          <button title="Motivos de cancelamento" onClick={() => navigate('/empresas/motivos')} className={`${ICONE} bg-red-100 text-red-500`}><XCircle size={18} /></button>
          <button title="Alterar responsaveis pelo dpto da(s) empresa(s) listada(s)" onClick={() => { toggleBarra('resp'); setRespDepto(departamentos[0]?.id ?? ''); setRespUser(usuarios[0]?.id ?? ''); }} className={`${ICONE} bg-marca-100 text-marca-600`}><Network size={18} /></button>
          <button title="Incluir tag's em massa nas empresas listadas" onClick={() => { toggleBarra('tags'); setTagsSel([]); }} className={`${ICONE} bg-status-ok/15 text-status-ok`}><TagsIcon size={18} /></button>
          <button title="Relacao de empresas" onClick={() => toggleBarra('relacao')} className={`${ICONE} bg-roxo-100 text-roxo-500`}><Printer size={18} /></button>
          <button title="Exibir/Ocultar datas" onClick={() => toggleBarra('datas')} className={`${ICONE} bg-red-100 text-red-500`}><Calendar size={18} /></button>
        </div>

        <button className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={16} /> Filtrar</button>
        {podeCriar && <button onClick={() => navigate('/empresas/nova')} className="flex items-center gap-2 rounded bg-marca-500 px-5 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Nova empresa</button>}
      </div>

      {/* Barra: Alterar responsavel pelo dpto */}
      {barra === 'resp' && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Atualizar nas {pagina?.total ?? 0} empresas listadas o responsavel do dpto:</label>
            <select className="w-full rounded border border-marca-300 bg-white px-2 py-2 text-[13px]" value={respDepto} onChange={(e) => setRespDepto(e.target.value)}>
              {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div className="min-w-[220px]">
            <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Para o responsavel:</label>
            <select className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-[13px]" value={respUser} onChange={(e) => setRespUser(e.target.value)}>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <button onClick={atualizarResponsavel} className="flex items-center gap-2 rounded bg-marca-400 px-5 py-2 text-sm font-medium text-white hover:bg-marca-500"><Network size={16} /> OK - Atualizar</button>
          <button onClick={() => setBarra(null)} className="flex items-center gap-2 rounded bg-status-warn px-5 py-2 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Cancelar</button>
        </div>
      )}

      {/* Barra: Incluir tags em massa */}
      {barra === 'tags' && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="relative min-w-[260px] flex-1">
            <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Adicionar nas {pagina?.total ?? 0} empresas listadas as Tag's:</label>
            <div className="flex flex-wrap items-center gap-1.5 rounded border border-marca-300 bg-white px-2 py-1.5">
              {tagsSel.map((id) => {
                const t = tags.find((x) => x.id === id);
                return <span key={id} className="inline-flex items-center gap-1 rounded bg-fundo px-2 py-0.5 text-[12px] text-slate-600"><button onClick={() => setTagsSel((a) => a.filter((x) => x !== id))} className="text-slate-400 hover:text-red-500">×</button>{t?.nome ?? id}</span>;
              })}
              <input className="min-w-[120px] flex-1 text-[13px] outline-none" placeholder="Tag's..." value={tagTxt}
                onChange={(e) => { setTagTxt(e.target.value); setTagAberto(true); }}
                onFocus={() => setTagAberto(true)} onBlur={() => setTimeout(() => setTagAberto(false), 150)} />
            </div>
            {tagAberto && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">Tag's</div>
                {tags.filter((t) => !tagsSel.includes(t.id) && t.nome.toLowerCase().includes(tagTxt.trim().toLowerCase())).map((t) => (
                  <button key={t.id} onMouseDown={() => { setTagsSel((a) => [...a, t.id]); setTagTxt(''); }} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-marca-50">{t.nome}</button>
                ))}
                {tags.filter((t) => !tagsSel.includes(t.id) && t.nome.toLowerCase().includes(tagTxt.trim().toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-[12px] text-slate-400">Nenhuma tag.</div>
                )}
              </div>
            )}
          </div>
          <button onClick={adicionarTags} className="flex items-center gap-2 rounded bg-marca-400 px-5 py-2 text-sm font-medium text-white hover:bg-marca-500"><TagsIcon size={16} /> OK - Adicionar</button>
          <button onClick={() => setBarra(null)} className="flex items-center gap-2 rounded bg-status-warn px-5 py-2 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Cancelar</button>
        </div>
      )}

      {/* Barra: Relacao de empresas (exportacoes) */}
      {barra === 'relacao' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => toast('ok', 'Em construcao: PDF')} className="flex items-center gap-2 rounded bg-marca-400 px-5 py-2 text-sm font-medium text-white hover:bg-marca-500"><Printer size={16} /> PDF</button>
          <button onClick={() => toast('ok', 'Em construcao: Excel Compacto')} className="flex items-center gap-2 rounded bg-roxo-500 px-5 py-2 text-sm font-medium text-white hover:bg-roxo-600"><Printer size={16} /> Excel Compacto</button>
          <button onClick={() => toast('ok', 'Em construcao: Excel Completo')} className="flex items-center gap-2 rounded bg-amber-400 px-5 py-2 text-sm font-medium text-white hover:bg-amber-500"><Printer size={16} /> Excel Completo</button>
          <button onClick={() => toast('ok', 'Em construcao: Excel Completo com Contatos')} className="flex items-center gap-2 rounded bg-slate-400 px-5 py-2 text-sm font-medium text-white hover:bg-slate-500"><Printer size={16} /> Excel Completo com Contatos</button>
          <button onClick={() => toast('ok', 'Em construcao: Empresas inativas em uso')} className="flex items-center gap-2 rounded bg-pink-600 px-5 py-2 text-sm font-medium text-white hover:bg-pink-700"><Printer size={16} /> Empresas inativas em uso</button>
        </div>
      )}

      {/* Barra: Exibir/Ocultar datas (filtros por data) */}
      {barra === 'datas' && (
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
          {([
            ['aberturaDe', 'Abertura de...'], ['aberturaAte', 'Abertura ate...'],
            ['desdeDe', 'Cliente desde de...'], ['desdeAte', 'Cliente desde ate...'],
            ['ateDe', 'Cliente ate de...'], ['ateAte', 'Cliente ate ate...'],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <label className="mb-0.5 block text-[11px] text-slate-500">{label}</label>
              <input type="date" className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[12px]" value={datas[k]} onChange={(e) => setDatas((d) => ({ ...d, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
      )}

      {/* Barra: Exportar e-mails em bloco */}
      {barra === 'export' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="min-w-[220px] flex-1 rounded border border-marca-300 bg-white px-2 py-2 text-[13px]" value={expDepto} onChange={(e) => setExpDepto(e.target.value)}>
            <option value="">Dptos (todos)</option>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select className="rounded border border-slate-300 bg-white px-2 py-2 text-[13px]" value={expBloco} onChange={(e) => setExpBloco(e.target.value)}>
            {['5', '15', '30', '50', '100', '300', '500'].map((n) => <option key={n} value={n}>Blocos de {n} em {n} enderecos</option>)}
          </select>
          <select className="rounded border border-slate-300 bg-white px-2 py-2 text-[13px]" value={expTipo} onChange={(e) => setExpTipo(e.target.value as typeof expTipo)}>
            <option value="nomes">Exportar enderecos e nomes</option>
            <option value="enderecos">Exportar somente enderecos</option>
          </select>
          <button onClick={() => toast('ok', 'Em construcao: exportacao de e-mails em bloco.')} className="flex items-center gap-2 rounded bg-marca-400 px-5 py-2 text-sm font-medium text-white hover:bg-marca-500"><Mail size={16} /> Exportar e-mail's</button>
          <button onClick={() => setBarra(null)} className="flex items-center gap-2 rounded bg-status-warn px-5 py-2 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      )}

      {/* Filtro por motivo de cancelamento (vindo da tela de Motivos) */}
      {motivoUrl && (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded bg-roxo-100 px-2.5 py-1 text-[12px] font-medium text-roxo-700">
            Motivo de cancelamento: {motivos.find((m) => m.id === motivoUrl)?.nome ?? '...'}
            <button onClick={() => navigate('/empresas')} className="text-roxo-500 hover:text-red-500">×</button>
          </span>
        </div>
      )}

      {/* +Filtros: combo com chips agrupados (Status / Grupo / Tag / Departamento) */}
      {!barra && mostrarFiltros && (
        <div className="relative mt-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1.5">
            {chips.map((c) => (
              <span key={`${c.kind}-${c.valor}`} className="inline-flex items-center gap-1 rounded bg-fundo px-2 py-0.5 text-[12px] text-slate-600">
                <button onClick={() => removeChip(c)} className="text-slate-400 hover:text-red-500">×</button>{c.label}
              </span>
            ))}
            <input className="min-w-[120px] flex-1 text-[13px] outline-none" placeholder="Filtros..." value={comboTxt}
              onChange={(e) => { setComboTxt(e.target.value); setComboAberto(true); }}
              onFocus={() => setComboAberto(true)} onBlur={() => setTimeout(() => setComboAberto(false), 150)} />
          </div>
          {comboAberto && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
              {optsStatus.length > 0 && <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">Filtrar por Status</div>}
              {optsStatus.map((o) => (
                <button key={o.valor} onMouseDown={() => addChip({ kind: 'status', valor: o.valor, label: o.label })} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-marca-50">{o.label}</button>
              ))}
              {optsGrupos.length > 0 && <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">Filtrar por grupos de empresa</div>}
              {optsGrupos.map((g) => (
                <button key={g.id} onMouseDown={() => addChip({ kind: 'grupo', valor: g.id, label: `Grupo: ${g.nome}` })} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-marca-50">Grupo: {g.nome}</button>
              ))}
              {optsTags.length > 0 && <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">Filtrar por Tag's</div>}
              {optsTags.map((t) => (
                <button key={t.id} onMouseDown={() => addChip({ kind: 'tag', valor: t.id, label: `Tag: ${t.nome}` })} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-marca-50">Tag: {t.nome}</button>
              ))}
              {optsDeptos.length > 0 && <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">Filtrar por Departamento</div>}
              {optsDeptos.map((d) => (
                <button key={d.id} onMouseDown={() => addChip({ kind: 'departamento', valor: d.id, label: `Depto: ${d.nome}` })} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-marca-50">Depto: {d.nome}</button>
              ))}
              {optsStatus.length + optsGrupos.length + optsTags.length + optsDeptos.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-slate-400">Nenhum filtro encontrado.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabela */}
      {barra !== 'export' && (
      <div className="mt-3 overflow-hidden rounded border border-slate-200 bg-white">
        {loading && !pagina ? <Spinner /> : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left align-top text-[12px] font-semibold text-marca-600">
                <th className="px-4 py-2">
                  <button onClick={() => ordenarPor('razao')} className="flex items-center gap-1 hover:underline">Razao social [ID] <ArrowUpDown size={12} /></button>
                  <button onClick={() => ordenarPor('fantasia')} className="mt-0.5 block font-normal text-slate-500 hover:underline">Nome Fantasia</button>
                </th>
                <th className="px-4 py-2">CNPJ<div className="font-normal text-slate-500">Telefone</div></th>
                <th className="px-4 py-2">
                  Cidade
                  <div className="flex items-center gap-1 font-normal text-slate-500">
                    Grupo de empresas
                    <button title="Cadastro de grupos" onClick={() => navigate('/empresas/grupos')} className="text-marca-500 hover:text-marca-700"><Pencil size={12} /></button>
                  </div>
                </th>
                <th className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    Regime
                    <button title="Cadastro de regimes" onClick={() => navigate('/obrigacoes/regimes')} className="text-marca-500 hover:text-marca-700"><Pencil size={12} /></button>
                  </div>
                  <div className="flex items-center gap-1 font-normal text-slate-500">
                    Tags
                    <button title="Cadastro de tags" onClick={() => navigate('/cadastros/tags')} className="text-marca-500 hover:text-marca-700"><Pencil size={12} /></button>
                  </div>
                </th>
                <th className="px-4 py-2 text-right align-top">
                  <div>[{pagina?.total ?? 0} reg.]</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itensOrdenados.map((e) => (
                <Fragment key={e.id}>
                <tr className="cursor-pointer align-top hover:bg-slate-50" onClick={() => navigate(`/empresas/${e.id}`)}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-marca-600">{e.razaoSocial} <span className="font-normal text-slate-400">[{e.numero ?? '-'}]</span>{!e.ativo && <span className="text-slate-400"> [inativa]</span>}</div>
                    <div className="text-slate-500">{e.nomeFantasia ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      {podeExcluir && <button title={`Apagar empresa [${e.numero ?? '-'}]`} onClick={() => excluirEmpresa(e.id, e.razaoSocial)} className="text-status-danger hover:text-red-700"><Trash2 size={14} /></button>}
                      {e.cnpj ? formatarIdent('CNPJ', e.cnpj) : '—'}
                    </div>
                    <div className="text-slate-400">{e.telefone ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-600">{e.cidade ?? '—'}</div>
                    <div className="text-slate-400">{e.grupoNome ?? 'Geral'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-600">{e.regimeNome ?? '—'}</div>
                    {!e.ativo && <div className="text-[11px] text-status-warn">(Empresa inativa)</div>}
                    {e.motivoNome && <div className="text-[11px] text-status-warn">{e.motivoNome}</div>}
                    <div className="mt-0.5 flex flex-wrap gap-1">{e.tags.map((t) => <Badge key={t.id} cor={t.cor}>{t.nome}</Badge>)}</div>
                  </td>
                  <td className="px-4 py-2" onClick={(ev) => ev.stopPropagation()}>
                    <div className="grid w-fit grid-cols-2 gap-x-2 gap-y-1">
                      <button title="Comentarios e anotacoes gerais" onClick={() => togglePainel(e.id, 'coment')} className={`hover:opacity-70 ${expandido?.id === e.id && expandido.painel === 'coment' ? 'text-status-ok ring-2 ring-status-ok/40 rounded' : 'text-status-ok'}`}><MessageCircle size={15} /></button>
                      <button title="Tarefas agendadas" onClick={() => togglePainel(e.id, 'tarefas')} className={`hover:opacity-70 ${expandido?.id === e.id && expandido.painel === 'tarefas' ? 'text-roxo-500 ring-2 ring-roxo-500/40 rounded' : 'text-roxo-500'}`}><CheckCircle2 size={15} /></button>
                      <button title="Contatos" onClick={() => togglePainel(e.id, 'contatos')} className={`hover:opacity-70 ${expandido?.id === e.id && expandido.painel === 'contatos' ? 'text-roxo-500 ring-2 ring-roxo-500/40 rounded' : 'text-roxo-500'}`}><Users size={15} /></button>
                      <button title="Responsaveis pelos departamentos" onClick={() => togglePainel(e.id, 'resp')} className={`hover:opacity-70 ${expandido?.id === e.id && expandido.painel === 'resp' ? 'text-marca-600 ring-2 ring-marca-600/40 rounded' : 'text-marca-600'}`}><Network size={15} /></button>
                    </div>
                  </td>
                </tr>
                {expandido?.id === e.id && (
                  <tr className="bg-fundo">
                    <td colSpan={5} className="border-l-4 border-marca-400 px-6 py-4" onClick={(ev) => ev.stopPropagation()}>
                      <PainelLinhaEmpresa
                        empresaId={e.id}
                        painel={expandido.painel}
                        departamentos={departamentos}
                        usuarios={usuarios}
                        podeEditar={podeEditar}
                        onFechar={() => setExpandido(null)}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Nenhuma empresa encontrada.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      )}

      {/* Paginacao */}
      {barra !== 'export' && pagina && pagina.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px]">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span className="text-slate-500">Pagina {pagina.page} de {pagina.totalPages} ({pagina.total} empresas)</span>
          <button className="btn-ghost" disabled={page >= pagina.totalPages} onClick={() => setPage((p) => p + 1)}>Proxima</button>
        </div>
      )}

    </div>
  );
}

// Painel inline expandido na linha da lista: carrega a ficha da empresa e
// reaproveita as mesmas secoes editaveis usadas na tela de consulta.
const TITULO_PAINEL: Record<'coment' | 'tarefas' | 'contatos' | 'resp', string> = {
  coment: 'Comentarios e Anotacoes gerais',
  tarefas: 'Tarefas agendadas',
  contatos: 'Contatos na empresa',
  resp: 'Responsaveis pelos departamentos',
};

function PainelLinhaEmpresa({ empresaId, painel, departamentos, usuarios, podeEditar, onFechar }: {
  empresaId: string;
  painel: 'coment' | 'tarefas' | 'contatos' | 'resp';
  departamentos: Departamento[];
  usuarios: UsuarioBasico[];
  podeEditar: boolean;
  onFechar: () => void;
}) {
  const [empresa, setEmpresa] = useState<EmpresaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  function recarregar() {
    return api.get<EmpresaDetalhe>(`/empresas/${empresaId}`).then((e) => { setEmpresa(e); return e; }).catch(() => undefined);
  }
  useEffect(() => { setCarregando(true); recarregar().finally(() => setCarregando(false)); }, [empresaId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-slate-700">{TITULO_PAINEL[painel]}</span>
        <button onClick={onFechar} className="text-[12px] text-slate-400 hover:text-slate-600">Fechar &times;</button>
      </div>
      {carregando || !empresa ? (
        <div className="py-4"><Spinner /></div>
      ) : painel === 'coment' ? (
        <SecComentarios empresa={empresa} departamentos={departamentos} onMudou={recarregar} />
      ) : painel === 'tarefas' ? (
        <SecTarefas empresa={empresa} departamentos={departamentos} />
      ) : painel === 'contatos' ? (
        <SecContatos empresa={empresa} podeEditar={podeEditar} onMudou={recarregar} />
      ) : (
        <SecResponsaveis empresa={empresa} departamentos={departamentos} usuarios={usuarios} podeEditar={podeEditar} onMudou={recarregar} />
      )}
    </div>
  );
}
