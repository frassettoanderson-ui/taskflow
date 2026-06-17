import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalMassa, setModalMassa] = useState(false);

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
  const todosSelecionados = useMemo(
    () => items.length > 0 && items.every((e) => selecionados.has(e.id)),
    [items, selecionados],
  );

  function toggle(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleTodos() {
    setSelecionados((s) => {
      const n = new Set(s);
      if (todosSelecionados) items.forEach((e) => n.delete(e.id));
      else items.forEach((e) => n.add(e.id));
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Empresas</h1>
        <div className="flex gap-2">
          {podeImportar && (
            <Link to="/empresas/importar" className="btn-ghost border border-slate-300">
              Importar CSV
            </Link>
          )}
          {podeCriar && (
            <Link to="/empresas/nova" className="btn-primary">
              + Nova empresa
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[220px]">
          <label className="label">Buscar (nome ou CNPJ)</label>
          <input
            className="input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Razao social, fantasia ou CNPJ..."
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as never)}>
            <option value="ativos">Ativas</option>
            <option value="inativos">Inativas</option>
            <option value="todos">Todas</option>
          </select>
        </div>
        <div>
          <label className="label">Tag</label>
          <select className="input" value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">Todas</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Departamento</label>
          <select className="input" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
            <option value="">Todos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Barra de acoes em massa */}
      {selecionados.size > 0 && podeEditar && (
        <div className="flex items-center gap-3 rounded-md bg-petroleo-50 px-4 py-2 text-sm">
          <span className="font-medium text-petroleo-700">
            {selecionados.size} selecionada(s)
          </span>
          <button className="btn-ghost" onClick={() => setModalMassa(true)}>
            Acoes em massa
          </button>
          <button className="btn-ghost" onClick={() => setSelecionados(new Set())}>
            Limpar
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading && !pagina ? (
          <Spinner />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {podeEditar && (
                  <th className="w-10 px-3 py-2">
                    <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} />
                  </th>
                )}
                <th className="px-3 py-2">Razao social</th>
                <th className="px-3 py-2">CNPJ</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Contatos</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => navigate(`/empresas/${e.id}`)}
                >
                  {podeEditar && (
                    <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selecionados.has(e.id)}
                        onChange={() => toggle(e.id)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-700">{e.razaoSocial}</div>
                    {e.nomeFantasia && (
                      <div className="text-xs text-slate-400">{e.nomeFantasia}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {e.cnpj ? formatarIdent('CNPJ', e.cnpj) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {e.tags.map((t) => (
                        <Badge key={t.id} cor={t.cor}>{t.nome}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{e.qtdContatos}</td>
                  <td className="px-3 py-2">
                    {e.ativo ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Ativa</Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-600">Inativa</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginacao */}
      {pagina && pagina.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span className="text-slate-500">
            Pagina {pagina.page} de {pagina.totalPages} ({pagina.total} empresas)
          </span>
          <button
            className="btn-ghost"
            disabled={page >= pagina.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Proxima
          </button>
        </div>
      )}

      {modalMassa && (
        <ModalAcaoMassa
          empresaIds={[...selecionados]}
          tags={tags}
          departamentos={departamentos}
          usuarios={usuarios}
          onFechar={() => setModalMassa(false)}
          onConcluido={(msg) => {
            toast('ok', msg);
            setModalMassa(false);
            setSelecionados(new Set());
            setPage((p) => p); // recarrega
            setBusca((b) => b);
          }}
        />
      )}
    </div>
  );
}

function ModalAcaoMassa({
  empresaIds,
  tags,
  departamentos,
  usuarios,
  onFechar,
  onConcluido,
}: {
  empresaIds: string[];
  tags: Tag[];
  departamentos: Departamento[];
  usuarios: UsuarioBasico[];
  onFechar: () => void;
  onConcluido: (msg: string) => void;
}) {
  const toast = useToast();
  const [acao, setAcao] = useState<'aplicar_tags' | 'alterar_responsavel' | 'inativar' | 'ativar'>('aplicar_tags');
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
