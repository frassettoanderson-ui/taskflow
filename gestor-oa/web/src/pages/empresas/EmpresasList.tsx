import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Search, SlidersHorizontal, Mail, Download, XCircle, Network, Tags as TagsIcon, Printer, Calendar, Plus, MessageCircle, CheckCircle2, Users, ArrowUpDown, RotateCcw } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Spinner, useToast } from '../../components/ui';
import type {
  EmpresaLista,
  Tag,
  Departamento,
  UsuarioBasico,
  GrupoEmpresa,
} from '../../lib/tipos';
import { formatarIdent } from '../../lib/tipos';

interface Pagina {
  items: EmpresaLista[];
  page: number;
  totalPages: number;
  total: number;
}

export default function EmpresasList() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeEditar = temPermissao(sessao, 'empresas_editar');
  const podeCriar = temPermissao(sessao, 'empresas_criar');
  const podeImportar = temPermissao(sessao, 'empresas_importar');
  const [searchParams] = useSearchParams();
  const motivoUrl = searchParams.get('motivo') ?? '';
  const grupoUrl = searchParams.get('grupo') ?? '';

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [tagId, setTagId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [grupoId, setGrupoId] = useState(grupoUrl);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [page, setPage] = useState(1);

  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [ordenar, setOrdenar] = useState<'razao' | 'fantasia'>('razao');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  // barra de acao ativa (so uma por vez; clicar de novo recolhe)
  const [barra, setBarra] = useState<'resp' | 'tags' | 'export' | 'relacao' | 'datas' | null>(null);
  const toggleBarra = (b: 'resp' | 'tags' | 'export' | 'relacao' | 'datas') => setBarra((atual) => (atual === b ? null : b));
  const [respDepto, setRespDepto] = useState('');
  const [respUser, setRespUser] = useState('');
  const [tagsSel, setTagsSel] = useState<string[]>([]);
  const [expDepto, setExpDepto] = useState('');
  const [expBloco, setExpBloco] = useState('50');
  const [expTipo, setExpTipo] = useState<'nomes' | 'enderecos'>('nomes');
  const [datas, setDatas] = useState({ aberturaDe: '', aberturaAte: '', desdeDe: '', desdeAte: '', ateDe: '', ateAte: '' });

  // Carrega filtros auxiliares uma vez
  useEffect(() => {
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
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
  }, [busca, status, tagId, departamentoId, grupoId, motivoUrl, page, toast]);

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

  const ICONE = 'flex h-9 w-9 items-center justify-center rounded hover:opacity-80';

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
          <div className="min-w-[260px] flex-1">
            <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Adicionar nas {pagina?.total ?? 0} empresas listadas as Tag's:</label>
            <div className="rounded border border-marca-300 bg-white p-1.5">
              <div className="mb-1 flex flex-wrap gap-1">
                {tagsSel.length === 0 && <span className="px-1 text-[12px] text-slate-400">Tag's...</span>}
                {tagsSel.map((id) => {
                  const t = tags.find((x) => x.id === id);
                  return <span key={id} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[12px] text-slate-600"><button onClick={() => setTagsSel((a) => a.filter((x) => x !== id))} className="text-slate-400 hover:text-red-500">×</button>{t?.nome ?? id}</span>;
                })}
              </div>
              <select className="w-full border-t border-slate-100 bg-transparent px-1 pt-1 text-[12px] text-slate-600 outline-none" value="" onChange={(e) => { if (e.target.value) setTagsSel((a) => [...a, e.target.value]); }}>
                <option value="">Tag's...</option>
                {tags.filter((t) => !tagsSel.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
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

      {/* Painel +Filtros */}
      {!barra && mostrarFiltros && (
        <div className="mt-2 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-3">
          <div>
            <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Status</label>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" value={status} onChange={(e) => setStatus(e.target.value as never)}>
              <option value="ativos">Ativas</option><option value="inativos">Inativas</option><option value="todos">Todas</option>
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Tag</label>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" value={tagId} onChange={(e) => setTagId(e.target.value)}>
              <option value="">Todas</option>{tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Departamento</label>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
              <option value="">Todos</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 flex items-center justify-between text-[12px] font-medium text-slate-600">Grupo de empresas
              <button type="button" onClick={() => navigate('/empresas/grupos')} className="text-[11px] font-normal text-marca-600 hover:underline">gerenciar</button>
            </label>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              <option value="">Todos</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
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
                <th className="px-4 py-2">Cidade<div className="font-normal text-slate-500">Grupo de empresas</div></th>
                <th className="px-4 py-2">Regime<div className="font-normal text-slate-500">Tags</div></th>
                <th className="px-4 py-2 text-right">
                  <div>[{pagina?.total ?? 0} reg.]</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itensOrdenados.map((e) => (
                <tr key={e.id} className="cursor-pointer align-top hover:bg-slate-50" onClick={() => navigate(`/empresas/${e.id}`)}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-marca-600">{e.razaoSocial} <span className="font-normal text-slate-400">[{e.numero ?? '-'}]</span>{!e.ativo && <span className="text-slate-400"> [inativa]</span>}</div>
                    <div className="text-slate-500">{e.nomeFantasia ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-600">{e.cnpj ? formatarIdent('CNPJ', e.cnpj) : '—'}</div>
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
                    <div className="grid grid-cols-2 gap-1.5">
                      <button title="Comentarios e anotacoes gerais" onClick={() => navigate(`/empresas/${e.id}`)} className="text-status-ok hover:opacity-70"><MessageCircle size={16} /></button>
                      <button title="Tarefas agendadas" onClick={() => toast('ok', 'Em construcao')} className="text-roxo-500 hover:opacity-70"><CheckCircle2 size={16} /></button>
                      <button title="Contatos" onClick={() => navigate(`/empresas/${e.id}`)} className="text-roxo-500 hover:opacity-70"><Users size={16} /></button>
                      <button title="Responsaveis pelos departamentos" onClick={() => navigate(`/empresas/${e.id}`)} className="text-marca-600 hover:opacity-70"><Network size={16} /></button>
                    </div>
                  </td>
                </tr>
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
