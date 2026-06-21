import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Landmark, Save, Plus, RotateCcw, Copy, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { Obrigacao } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 block text-[12px] font-medium text-slate-600';

interface Item { obrigacaoId: string; nome: string; departamento: string; tempoPrevisto: string }
interface EmpresaRegime { id: string; razaoSocial: string; nomeFantasia: string | null; cidade: string }
interface RegimeResp { id: string; nome: string; ativo: boolean; _count?: { empresas: number };
  obrigacoes: { obrigacaoId: string; tempoPrevistoOverride: number | null; obrigacao: { nome: string; departamento?: { nome?: string } | null } }[] }

export default function RegimeForm() {
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
  const [qtdEmpresas, setQtdEmpresas] = useState(0);
  const [empresas, setEmpresas] = useState<EmpresaRegime[] | null>(null);
  const [showEmpresas, setShowEmpresas] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [grupoFechado, setGrupoFechado] = useState<Record<string, boolean>>({});

  useEffect(() => { api.get<Obrigacao[]>('/obrigacoes').then(setCatalogo).catch(() => undefined); }, []);

  useEffect(() => {
    if (novo) return;
    api.get<RegimeResp>(`/regimes/${id}`).then((r) => {
      setNome(r.nome); setAtivo(r.ativo); setQtdEmpresas(r._count?.empresas ?? 0);
      setItens(r.obrigacoes.map((l) => ({
        obrigacaoId: l.obrigacaoId, nome: l.obrigacao.nome,
        departamento: l.obrigacao.departamento?.nome ?? 'Sem departamento',
        tempoPrevisto: String(l.tempoPrevistoOverride ?? 0),
      })));
    }).catch(() => toast('erro', 'Regime nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  const disponiveis = useMemo(
    () => catalogo.filter((o) => !itens.some((i) => i.obrigacaoId === o.id)),
    [catalogo, itens],
  );
  const grupos = useMemo(() => {
    const g: Record<string, Item[]> = {};
    for (const it of itens) (g[it.departamento] ??= []).push(it);
    return g;
  }, [itens]);

  function adicionar() {
    if (!novoSel) return;
    const o = catalogo.find((x) => x.id === novoSel);
    if (!o) return;
    setItens((arr) => [...arr, { obrigacaoId: o.id, nome: o.nome, departamento: o.departamento?.nome ?? 'Sem departamento', tempoPrevisto: '0' }]);
    setNovoSel('');
  }
  function setTempo(obrigacaoId: string, v: string) { setItens((arr) => arr.map((i) => i.obrigacaoId === obrigacaoId ? { ...i, tempoPrevisto: v } : i)); }
  function remover(obrigacaoId: string) { setItens((arr) => arr.filter((i) => i.obrigacaoId !== obrigacaoId)); }

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome do regime.');
    setSalvando(true);
    try {
      const payload = { nome, ativo, obrigacoes: itens.map((i) => ({ obrigacaoId: i.obrigacaoId, tempoPrevistoOverride: i.tempoPrevisto === '' ? null : Number(i.tempoPrevisto) })) };
      if (novo) await api.post('/regimes', payload);
      else await api.put(`/regimes/${id}`, payload);
      toast('ok', 'Regime salvo.');
      navigate('/obrigacoes/regimes');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  function listarEmpresas() {
    setShowEmpresas((v) => !v);
    if (empresas === null && !novo) api.get<EmpresaRegime[]>(`/regimes/${id}/empresas`).then(setEmpresas).catch(() => setEmpresas([]));
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-fundo p-5 text-[13px]">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Landmark size={16} className="text-slate-400" />
        <span>Obrigacoes</span><span className="text-slate-300">›</span>
        <span>Regimes tributarios</span><span className="text-slate-300">›</span>
        <span className="text-slate-700">Cadastro de regime tributario</span>
      </div>

      {/* Linha principal */}
      <div className="grid grid-cols-1 items-end gap-x-5 gap-y-3 md:grid-cols-[1fr_180px_auto]">
        <div>
          <label className={`${LBL} flex items-center justify-between`}>Nome do regime
            <button type="button" title="Copiar" onClick={() => { navigator.clipboard?.writeText(nome); toast('ok', 'Copiado.'); }} className="text-slate-400 hover:text-marca-600"><Copy size={13} /></button>
          </label>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do regime" />
        </div>
        <div>
          <label className={LBL}>Ativo?</label>
          <select className={INP} value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}><option value="sim">Sim</option><option value="nao">Nao</option></select>
        </div>
        <div className="flex gap-2">
          {pode && <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? '...' : 'Salvar'}</button>}
          <button onClick={() => { navigate('/obrigacoes/regimes/novo'); setNome(''); setAtivo(true); setItens([]); setQtdEmpresas(0); setEmpresas(null); }} className="flex items-center gap-2 rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo</button>
          <button onClick={() => navigate('/obrigacoes/regimes')} className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      {/* Obrigacoes do regime */}
      <div className="mt-4">
        <p className="mb-1 text-[13px] font-medium text-slate-700">Obrigacoes que devem ser entregues nesse regime <span className="font-normal text-marca-500">(as selecionadas abaixo serao automaticamente marcadas em novos cadastros de empresas)</span></p>
        <div className="flex gap-2">
          <select className={INP} value={novoSel} onChange={(e) => setNovoSel(e.target.value)}>
            <option value="">Selecione...</option>
            {disponiveis.map((o) => <option key={o.id} value={o.id}>{o.nome} [{o.departamento?.nome ?? 'Sem depto'}]</option>)}
          </select>
          <button onClick={adicionar} className="flex items-center gap-2 whitespace-nowrap rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Adicionar</button>
        </div>

        <div className="mt-2">
          {/* cabecalho da coluna Tempo previsto */}
          {itens.length > 0 && (
            <div className="flex items-center gap-3 pb-1">
              <span className="flex-1" />
              <span className="w-1/3 text-center text-[12px] font-medium text-slate-600">Tempo previsto (min)</span>
              <span className="w-40" />
            </div>
          )}
          {Object.keys(grupos).length === 0 && <p className="text-[12px] text-slate-400">Nenhuma obrigacao adicionada.</p>}
          {Object.entries(grupos).map(([dep, lista]) => {
            const fechado = grupoFechado[dep];
            return (
              <div key={dep} className="mb-1">
                <button onClick={() => setGrupoFechado((g) => ({ ...g, [dep]: !g[dep] }))} className="text-left text-[13px] font-medium text-marca-700">
                  {dep} <span className="font-normal text-marca-500">(clique para exibir/ocultar)</span>
                </button>
                {!fechado && (
                  <div className="mt-1 space-y-1">
                    {lista.map((it) => (
                      <div key={it.obrigacaoId} className="flex items-center gap-3">
                        <button onClick={() => navigate(`/obrigacoes/${it.obrigacaoId}`)} className="flex-1 text-left text-marca-600 hover:underline">{it.nome}</button>
                        <input className={`${INP} w-1/3 text-center`} value={it.tempoPrevisto} onChange={(e) => setTempo(it.obrigacaoId, e.target.value.replace(/\D/g, ''))} />
                        <button onClick={() => remover(it.obrigacaoId)} className="flex w-40 items-center justify-center gap-2 rounded bg-status-danger py-1.5 text-sm font-medium text-white hover:bg-red-600"><Trash2 size={15} /> Remover</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Empresas nesse regime */}
      {!novo && (
        <div className="mt-5">
          <button onClick={listarEmpresas} className="text-[13px] font-medium text-slate-700">
            Empresas que estao nesse regime [{qtdEmpresas} empresa] <span className="font-normal text-marca-500">(Clique para {showEmpresas ? 'ocultar' : 'listar'})</span>
          </button>
          {showEmpresas && (
            <div className="mt-1 overflow-hidden rounded border border-slate-200 bg-white">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600"><th className="px-4 py-1.5">Razao Social</th><th className="px-4 py-1.5">Nome Fantasia</th><th className="px-4 py-1.5">Cidade</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(empresas ?? []).map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-1.5"><button onClick={() => navigate(`/empresas/${e.id}`)} className="text-marca-600 hover:underline">{e.razaoSocial}</button></td>
                      <td className="px-4 py-1.5 text-slate-600">{e.nomeFantasia ?? '—'}</td>
                      <td className="px-4 py-1.5 text-slate-600">{e.cidade || '—'}</td>
                    </tr>
                  ))}
                  {empresas !== null && empresas.length === 0 && <tr><td colSpan={3} className="px-4 py-3 text-center text-slate-400">Nenhuma empresa.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Log das alteracoes */}
      {!novo && (
        <div className="mt-4">
          <button onClick={() => setShowLog((v) => !v)} className="text-[13px] font-medium text-slate-700">
            Log das alteracoes nos dados do regime tributario - ultimas 15 em ordem decrescente <span className="font-normal text-marca-500">(Clique para {showLog ? 'ocultar' : 'listar'})</span>
          </button>
          {showLog && (
            <div className="mt-1 overflow-hidden rounded border border-slate-200 bg-white">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600"><th className="px-4 py-1.5">Data e Hora</th><th className="px-4 py-1.5">Usuario</th><th className="px-4 py-1.5">Acao</th></tr></thead>
                <tbody><tr><td colSpan={3} className="px-4 py-3 text-[13px] text-status-danger">Nenhum Log encontrado para esse regime</td></tr></tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
