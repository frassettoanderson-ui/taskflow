import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Landmark, Save, Plus, RotateCcw, Trash2, Search, Copy } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { Obrigacao } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 block text-[13px] font-bold text-slate-700';

interface Item { obrigacaoId: string; nome: string; departamento: string; tempoPrevisto: number }
interface GrupoResp { id: string; nome: string; ativo: boolean; obrigacoes: { obrigacaoId: string; tempoPrevisto?: number; obrigacao: { nome: string; departamento?: { nome?: string } | null } }[] }

export default function GrupoForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const { sessao } = useAuth();
  const pode = temPermissao(sessao, 'obrigacoes_gerenciar');

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [itens, setItens] = useState<Item[]>([]);
  const [novoSel, setNovoSel] = useState('');
  const [catalogo, setCatalogo] = useState<Obrigacao[]>([]);
  const [grupoFechado, setGrupoFechado] = useState<Record<string, boolean>>({});

  useEffect(() => { api.get<Obrigacao[]>('/obrigacoes').then(setCatalogo).catch(() => undefined); }, []);

  useEffect(() => {
    if (novo) return;
    api.get<GrupoResp>(`/grupos/${id}`).then((g) => {
      setNome(g.nome); setAtivo(g.ativo);
      setItens(g.obrigacoes.map((l) => ({ obrigacaoId: l.obrigacaoId, nome: l.obrigacao.nome, departamento: l.obrigacao.departamento?.nome ?? 'Sem departamento', tempoPrevisto: l.tempoPrevisto ?? 0 })));
    }).catch(() => toast('erro', 'Grupo nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  const disponiveis = useMemo(() => catalogo.filter((o) => !itens.some((i) => i.obrigacaoId === o.id)), [catalogo, itens]);
  const grupos = useMemo(() => {
    const g: Record<string, Item[]> = {};
    for (const it of itens) (g[it.departamento] ??= []).push(it);
    return g;
  }, [itens]);

  function adicionar() {
    if (!novoSel) return;
    const o = catalogo.find((x) => x.id === novoSel);
    if (!o) return;
    setItens((arr) => [...arr, { obrigacaoId: o.id, nome: o.nome, departamento: o.departamento?.nome ?? 'Sem departamento', tempoPrevisto: 0 }]);
    setNovoSel('');
  }
  function remover(obrigacaoId: string) { setItens((arr) => arr.filter((i) => i.obrigacaoId !== obrigacaoId)); }

  // Duplica o grupo atual em um novo registro "(copia)"
  async function duplicar() {
    if (novo) return;
    try {
      const g = await api.post<{ id: string }>('/grupos', { nome: `${nome} (copia)`, ativo, obrigacoes: itens.map((i) => ({ obrigacaoId: i.obrigacaoId, tempoPrevisto: i.tempoPrevisto || 0 })) });
      toast('ok', 'Grupo duplicado.');
      navigate(`/obrigacoes/grupos/${g.id}`);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao duplicar.'); }
  }
  function setTempo(obrigacaoId: string, tempo: number) { setItens((arr) => arr.map((i) => (i.obrigacaoId === obrigacaoId ? { ...i, tempoPrevisto: tempo } : i))); }

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome do grupo.');
    setSalvando(true);
    try {
      const payload = { nome, ativo, obrigacoes: itens.map((i) => ({ obrigacaoId: i.obrigacaoId, tempoPrevisto: i.tempoPrevisto || 0 })) };
      if (novo) await api.post('/grupos', payload);
      else await api.put(`/grupos/${id}`, payload);
      toast('ok', 'Grupo salvo.');
      navigate('/obrigacoes/grupos');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Landmark size={16} className="text-slate-400" />
          <span>Obrigacoes</span><span className="text-slate-300">&rsaquo;</span>
          <span>Grupos obrigacoes</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-700">Cadastro de grupo de obrigacoes</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* Linha principal */}
      <div className="grid grid-cols-1 items-end gap-x-5 gap-y-3 md:grid-cols-[1fr_180px_auto]">
        <div>
          <div className="flex items-end justify-between">
            <label className={LBL}>Nome do grupo</label>
            {!novo && pode && <button onClick={duplicar} title="Duplicar este grupo" className="mb-1 text-marca-500 hover:text-marca-600"><Copy size={16} /></button>}
          </div>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do grupo" />
        </div>
        <div>
          <label className={LBL}>Ativo?</label>
          <select className={INP} value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}><option value="sim">Sim</option><option value="nao">Nao</option></select>
        </div>
        <div className="flex gap-2">
          {pode && <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? '...' : 'Salvar'}</button>}
          {pode && <button onClick={() => navigate('/obrigacoes/grupos/novo')} className="flex items-center gap-2 rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo</button>}
          <button onClick={() => navigate('/obrigacoes/grupos')} className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      {/* Obrigacoes do grupo: so na edicao (no Novo nao exibe) */}
      {!novo && (
      <div className="mt-4">
        <p className="mb-1 text-[13px] font-bold text-slate-700">Obrigacoes desse grupo</p>
        <div className="flex gap-2">
          <select className={INP} value={novoSel} onChange={(e) => setNovoSel(e.target.value)}>
            <option value="">Selecione...</option>
            {disponiveis.map((o) => <option key={o.id} value={o.id}>{o.nome} [{o.departamento?.nome ?? 'Sem depto'}]</option>)}
          </select>
          <button onClick={adicionar} className="flex items-center gap-2 whitespace-nowrap rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Adicionar</button>
        </div>

        <div className="mt-2">
          {Object.keys(grupos).length === 0 && <p className="text-[12px] text-slate-400">Nenhuma obrigacao adicionada.</p>}
          {Object.entries(grupos).map(([dep, lista]) => (
            <div key={dep} className="mb-2">
              {/* Cabecalho do departamento (abre/fecha em dropdown) + titulo da coluna */}
              <div className="grid grid-cols-[1fr_1fr_180px] items-center gap-3 py-1">
                <button onClick={() => setGrupoFechado((g) => ({ ...g, [dep]: !g[dep] }))} className="text-left text-[13px] font-bold text-roxo-600">
                  {dep} <span className="font-normal text-roxo-400">(clique para exibir/ocultar)</span>
                </button>
                <span className="text-center text-[13px] text-slate-600">Tempo previsto (min)</span>
                <span />
              </div>
              {!grupoFechado[dep] && (
                <div>
                  {lista.map((it, idx) => (
                    <div key={it.obrigacaoId} className={`grid grid-cols-[1fr_1fr_180px] items-center gap-3 px-2 py-1.5 ${idx % 2 ? 'bg-fundo' : 'bg-white'}`}>
                      <button onClick={() => navigate(`/obrigacoes/${it.obrigacaoId}`)} className="text-left text-marca-600 hover:underline">{it.nome}</button>
                      <input type="number" min={0} value={it.tempoPrevisto} onChange={(e) => setTempo(it.obrigacaoId, Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-center text-[13px] text-slate-700 outline-none focus:border-marca-400" />
                      <button onClick={() => remover(it.obrigacaoId)} className="flex items-center justify-center gap-2 rounded bg-status-danger py-1.5 text-sm font-medium text-white hover:bg-red-600"><Trash2 size={15} /> Remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
