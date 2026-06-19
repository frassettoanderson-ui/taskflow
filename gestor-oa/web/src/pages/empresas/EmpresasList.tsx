import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Search, SlidersHorizontal, Mail, Download, XCircle, Network, Tags as TagsIcon, Printer, Calendar, Plus, MessageCircle, CheckCircle2, Users, ArrowUpDown } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type {
  EmpresaLista,
  Tag,
  Departamento,
  UsuarioBasico,
} from '../../lib/tipos';
import { formatarIdent } from '../../lib/tipos';

type AcaoMassa = 'aplicar_tags' | 'alterar_responsavel' | 'inativar' | 'ativar';

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

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [tagId, setTagId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [page, setPage] = useState(1);

  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [ordenar, setOrdenar] = useState<'razao' | 'fantasia'>('razao');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [massa, setMassa] = useState<{ ids: string[]; acao: AcaoMassa } | null>(null);

  // Carrega filtros auxiliares uma vez
  useEffect(() => {
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
      api
        .get<Pagina>(`/empresas?${qs.toString()}`)
        .then(setPagina)
        .catch((e) => toast('erro', e instanceof ApiError ? e.message : 'Erro'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [busca, status, tagId, departamentoId, page, toast]);

  // Reseta pagina ao mudar filtros
  useEffect(() => setPage(1), [busca, status, tagId, departamentoId]);

  const items = pagina?.items ?? [];
  const itensOrdenados = useMemo(() => {
    const campo = ordenar === 'razao' ? 'razaoSocial' : 'nomeFantasia';
    return [...items].sort((a, b) => {
      const va = (a[campo] ?? '').toString().toLowerCase();
      const vb = (b[campo] ?? '').toString().toLowerCase();
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [items, ordenar, dir]);

  function abrirMassa(acao: AcaoMassa) {
    const ids = items.map((e) => e.id);
    if (!ids.length) return toast('erro', 'Nenhuma empresa listada.');
    setMassa({ ids, acao });
  }
  function ordenarPor(campo: 'razao' | 'fantasia') {
    if (ordenar === campo) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setOrdenar(campo); setDir('asc'); }
  }

  const ICONE = 'flex h-9 w-9 items-center justify-center rounded hover:opacity-80';

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
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
        <button onClick={() => setMostrarFiltros((v) => !v)} className="flex items-center gap-2 rounded bg-purple-300 px-4 py-2 text-sm font-medium text-white hover:bg-purple-400"><SlidersHorizontal size={15} /> +Filtros</button>

        <div className="flex items-center gap-1">
          <button title="Exporta e-mails em bloco" onClick={() => toast('ok', 'Em construcao')} className={`${ICONE} bg-status-ok/15 text-status-ok`}><Mail size={18} /></button>
          {podeImportar && <button title="Importar cadastros" onClick={() => navigate('/empresas/importar')} className={`${ICONE} bg-marca-100 text-marca-600`}><Download size={18} /></button>}
          <button title="Motivos de cancelamento" onClick={() => toast('ok', 'Em construcao')} className={`${ICONE} bg-red-100 text-red-500`}><XCircle size={18} /></button>
          <button title="Alterar responsaveis pelo dpto da(s) empresa(s) listada(s)" onClick={() => abrirMassa('alterar_responsavel')} className={`${ICONE} bg-marca-100 text-marca-600`}><Network size={18} /></button>
          <button title="Incluir tag's em massa nas empresas listadas" onClick={() => abrirMassa('aplicar_tags')} className={`${ICONE} bg-status-ok/15 text-status-ok`}><TagsIcon size={18} /></button>
          <button title="Relacao de empresas" onClick={() => toast('ok', 'Em construcao')} className={`${ICONE} bg-purple-100 text-purple-500`}><Printer size={18} /></button>
          <button title="Exibir/Ocultar datas" onClick={() => toast('ok', 'Em construcao')} className={`${ICONE} bg-red-100 text-red-500`}><Calendar size={18} /></button>
        </div>

        <button className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={16} /> Filtrar</button>
        {podeCriar && <button onClick={() => navigate('/empresas/nova')} className="flex items-center gap-2 rounded bg-marca-500 px-5 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Nova empresa</button>}
      </div>

      {/* Painel +Filtros */}
      {mostrarFiltros && (
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
        </div>
      )}

      {/* Tabela */}
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
                    <div className="font-medium text-marca-600">{e.razaoSocial}{!e.ativo && <span className="text-slate-400"> [inativa]</span>}</div>
                    <div className="text-slate-500">{e.nomeFantasia ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-600">{e.cnpj ? formatarIdent('CNPJ', e.cnpj) : '—'}</div>
                    <div className="text-slate-400">{e.telefone ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-600">{e.cidade ?? '—'}</div>
                    <div className="text-slate-400">Geral</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-600">{e.regimeNome ?? '—'}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">{e.tags.map((t) => <Badge key={t.id} cor={t.cor}>{t.nome}</Badge>)}</div>
                  </td>
                  <td className="px-4 py-2" onClick={(ev) => ev.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button title="Comentarios e anotacoes gerais" onClick={() => navigate(`/empresas/${e.id}`)} className="text-status-ok hover:opacity-70"><MessageCircle size={16} /></button>
                      <button title="Tarefas agendadas" onClick={() => toast('ok', 'Em construcao')} className="text-purple-500 hover:opacity-70"><CheckCircle2 size={16} /></button>
                      <button title="Contatos" onClick={() => navigate(`/empresas/${e.id}`)} className="text-purple-500 hover:opacity-70"><Users size={16} /></button>
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

      {/* Paginacao */}
      {pagina && pagina.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px]">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span className="text-slate-500">Pagina {pagina.page} de {pagina.totalPages} ({pagina.total} empresas)</span>
          <button className="btn-ghost" disabled={page >= pagina.totalPages} onClick={() => setPage((p) => p + 1)}>Proxima</button>
        </div>
      )}

      {massa && (
        <ModalAcaoMassa
          empresaIds={massa.ids}
          acaoInicial={massa.acao}
          tags={tags}
          departamentos={departamentos}
          usuarios={usuarios}
          onFechar={() => setMassa(null)}
          onConcluido={(msg) => { toast('ok', msg); setMassa(null); setBusca((b) => b); }}
        />
      )}
    </div>
  );
}

// (bloco antigo abaixo substituido)

function ModalAcaoMassa({
  empresaIds,
  acaoInicial,
  tags,
  departamentos,
  usuarios,
  onFechar,
  onConcluido,
}: {
  empresaIds: string[];
  acaoInicial?: AcaoMassa;
  tags: Tag[];
  departamentos: Departamento[];
  usuarios: UsuarioBasico[];
  onFechar: () => void;
  onConcluido: (msg: string) => void;
}) {
  const toast = useToast();
  const [acao, setAcao] = useState<AcaoMassa>(acaoInicial ?? 'aplicar_tags');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [departamentoId, setDepartamentoId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function executar() {
    setSalvando(true);
    try {
      const r = await api.post<{ afetadas: number }>('/empresas/acoes-massa', {
        empresaIds,
        acao,
        tagIds: acao === 'aplicar_tags' ? tagIds : undefined,
        departamentoId: acao === 'alterar_responsavel' ? departamentoId : undefined,
        usuarioId: acao === 'alterar_responsavel' ? usuarioId : undefined,
      });
      onConcluido(`${r.afetadas} empresa(s) atualizada(s).`);
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto titulo={`Acoes em massa (${empresaIds.length})`} onFechar={onFechar}>
      <div className="space-y-4">
        <div>
          <label className="label">Acao</label>
          <select className="input" value={acao} onChange={(e) => setAcao(e.target.value as never)}>
            <option value="aplicar_tags">Aplicar tags</option>
            <option value="alterar_responsavel">Alterar responsavel de departamento</option>
            <option value="inativar">Inativar</option>
            <option value="ativar">Ativar</option>
          </select>
        </div>

        {acao === 'aplicar_tags' && (
          <div>
            <label className="label">Tags a aplicar</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <label key={t.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={tagIds.includes(t.id)}
                    onChange={(e) =>
                      setTagIds((ids) =>
                        e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id),
                      )
                    }
                  />
                  {t.nome}
                </label>
              ))}
              {tags.length === 0 && <span className="text-slate-400">Nenhuma tag cadastrada.</span>}
            </div>
          </div>
        )}

        {acao === 'alterar_responsavel' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Departamento</label>
              <select className="input" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
                <option value="">Selecione</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Responsavel</label>
              <select className="input" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                <option value="">Selecione</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={executar} disabled={salvando}>
            {salvando ? 'Aplicando...' : 'Aplicar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
