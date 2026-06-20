import { useEffect, useState } from 'react';
import { Settings2, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Spinner, Modal, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';
import type { Tag, GrupoEmpresa } from '../lib/tipos';

interface Dashboard {
  colaboradores: number; salarios: number; minutosEquipe: number; custoMinuto: number;
  minAlocados: number; produtividadePct: number; minDisponiveis: number; capacidadeExpansaoPct: number;
  clientesAtivos: number; honorarios: number; ticketMedio: number; dinheiroNaMesa: number;
  custosFixos: number; resultado: number; lucratividadePct: number;
}
interface Capacidade { id: string; nome: string; disponivel: number; alocado: number; entregue: number; prodPct: number; entreguePct: number; cor: string }
interface EmpresaApla { id: string; empresa: string; obrigacoes: number; honorario: number; horas: number; custoRH: number; custoFixo: number; resultado: number; resultadoPct: number }
interface CustoFixo { id: string; nome: string; escopo: 'GERAL' | 'GRUPO' | 'TAG' | 'EMPRESA'; grupoId: string | null; tagId: string | null; empresaId: string | null; valor: number; ativo: boolean }
interface Apla {
  periodo: string; custoHora: number; custoMinuto: number;
  dashboard: Dashboard;
  capacidade: Capacidade[];
  empresas: EmpresaApla[];
  porDepartamento: { nome: string; cor: string; receita: number; custo: number; margem: number }[];
  custosFixos: CustoFixo[];
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const min = (n: number) => `${n.toLocaleString('pt-BR')} min`;
const ABAS = ['Dashboard', 'Capacidade produtiva', 'Lucratividade'] as const;

export default function Apla({ abaInicial = 0 }: { abaInicial?: number }) {
  const toast = useToast();
  const { sessao } = useAuth();
  const podeConfig = !!sessao?.usuario.permissoes['apla_configurar'];
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [aba, setAba] = useState(abaInicial);
  const [d, setD] = useState<Apla | null>(null);
  const [loading, setLoading] = useState(true);
  const [cfgAberto, setCfgAberto] = useState(false);
  const [custoHora, setCustoHora] = useState('');
  const [custoModal, setCustoModal] = useState(false);

  function carregar() {
    setLoading(true);
    api.get<Apla>(`/apla/relatorio?ano=${ano}&mes=${mes}`).then((r) => { setD(r); setCustoHora(String(r.custoHora)); }).finally(() => setLoading(false));
  }
  useEffect(carregar, [ano, mes]);

  async function salvarConfig() {
    try {
      await api.put('/apla/config', { custoHora: Number(custoHora) || 0 });
      setCfgAberto(false); toast('ok', 'Custo/hora atualizado.'); carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro.'); }
  }

  if (loading || !d) return <Spinner />;
  const db = d.dashboard;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Metodo APLA</h1>
          <p className="text-sm text-slate-500">Produtividade e lucratividade · {d.periodo} · custo/minuto {brl(d.custoMinuto)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-24" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
          </select>
          <select className="input w-28" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {podeConfig && <button className="btn-ghost border border-slate-300" onClick={() => setCfgAberto(true)}><Settings2 size={16} /> Custo/hora</button>}
        </div>
      </div>

      {/* abas */}
      <div className="flex gap-1 border-b border-slate-200">
        {ABAS.map((a, i) => (
          <button key={a} onClick={() => setAba(i)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${aba === i ? 'border-marca-500 text-marca-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {a}
          </button>
        ))}
      </div>

      {aba === 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Card titulo="Colaboradores" valor={String(db.colaboradores)} />
          <Card titulo="Salarios (RH/mes)" valor={brl(db.salarios)} cor="text-amber-600" />
          <Card titulo="Minutos da equipe" valor={min(db.minutosEquipe)} />
          <Card titulo="Custo por minuto" valor={brl(db.custoMinuto)} cor="text-amber-600" />
          <Card titulo="Minutos alocados" valor={min(db.minAlocados)} />
          <Card titulo="Produtividade" valor={`${db.produtividadePct}%`} cor="text-marca-600" />
          <Card titulo="Minutos disponiveis" valor={min(db.minDisponiveis)} />
          <Card titulo="Cap. de expansao" valor={`${db.capacidadeExpansaoPct}%`} cor="text-sky-600" />
          <Card titulo="Clientes ativos" valor={String(db.clientesAtivos)} />
          <Card titulo="Honorarios" valor={brl(db.honorarios)} cor="text-emerald-600" />
          <Card titulo="Ticket medio" valor={brl(db.ticketMedio)} cor="text-sky-600" />
          <Card titulo="Dinheiro na mesa" valor={brl(db.dinheiroNaMesa)} cor="text-purple-600" sub="receita potencial ociosa" />
          <Card titulo="Custos fixos" valor={brl(db.custosFixos)} cor="text-amber-600" />
          <Card titulo="Resultado" valor={brl(db.resultado)} cor={db.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} />
          <Card titulo="Lucratividade" valor={`${db.lucratividadePct}%`} cor={db.resultado >= 0 ? 'text-marca-600' : 'text-red-600'} />
        </div>
      )}

      {aba === 1 && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Dot c="#cf3c5d" /> Ocioso (&le;30%)</span>
            <span className="flex items-center gap-1"><Dot c="#f0ad4e" /> Baixo (31-60%)</span>
            <span className="flex items-center gap-1"><Dot c="#5cb85c" /> Ideal (61-100%)</span>
            <span className="flex items-center gap-1"><Dot c="#7e57c2" /> Sobrecarga (&gt;100%)</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Colaborador</th><th className="px-3 py-2 w-1/2">Ocupacao (alocado / disponivel)</th><th className="px-3 py-2">Disponivel</th><th className="px-3 py-2">Alocado</th><th className="px-3 py-2">Entregue</th></tr>
            </thead>
            <tbody>
              {d.capacidade.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">{c.nome}</td>
                  <td className="px-3 py-2">
                    <div className="h-3 w-full overflow-hidden rounded bg-slate-100">
                      <div className="h-full" style={{ width: `${Math.min(100, c.prodPct)}%`, background: c.cor }} />
                    </div>
                    <span className="text-xs" style={{ color: c.cor }}>{c.prodPct}%</span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{min(c.disponivel)}</td>
                  <td className="px-3 py-2 text-slate-600">{min(c.alocado)}</td>
                  <td className="px-3 py-2 text-emerald-600">{min(c.entregue)}</td>
                </tr>
              ))}
              {d.capacidade.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Sem colaboradores com minutos uteis configurados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {aba === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Lucratividade por empresa (pior resultado primeiro)</h2>
            {podeConfig && <button className="btn-ghost border border-slate-300" onClick={() => setCustoModal(true)}><Plus size={15} /> Custos fixos ({d.custosFixos.length})</button>}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Obrig.</th><th className="px-3 py-2">Honorario</th><th className="px-3 py-2">Custo RH</th><th className="px-3 py-2">Custo fixo</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">%</th></tr>
              </thead>
              <tbody>
                {d.empresas.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{e.empresa}</td>
                    <td className="px-3 py-2 text-slate-500">{e.obrigacoes}</td>
                    <td className="px-3 py-2 text-slate-600">{brl(e.honorario)}</td>
                    <td className="px-3 py-2 text-slate-500">{brl(e.custoRH)}</td>
                    <td className="px-3 py-2 text-slate-500">{brl(e.custoFixo)}</td>
                    <td className={`px-3 py-2 font-medium ${e.resultado < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{brl(e.resultado)}</td>
                    <td className={`px-3 py-2 ${e.resultado < 0 ? 'text-red-600' : 'text-slate-500'}`}>{e.resultadoPct}%</td>
                  </tr>
                ))}
                {d.empresas.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Sem honorarios/obrigacoes cadastrados. Informe honorarios na ficha da empresa.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal aberto={cfgAberto} titulo="Custo medio da hora produtiva" onFechar={() => setCfgAberto(false)}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Fallback usado quando o colaborador nao tem salario/encargos/beneficios informados.</p>
          <label className="block text-sm text-slate-600">Custo por hora (R$)
            <input className="input mt-1 w-full" type="number" min={0} step="0.01" value={custoHora} onChange={(e) => setCustoHora(e.target.value)} />
          </label>
          <div className="flex justify-end"><button className="btn-primary" onClick={salvarConfig}>Salvar</button></div>
        </div>
      </Modal>

      {custoModal && <CustosFixosModal custos={d.custosFixos} onFechar={() => setCustoModal(false)} onMudou={carregar} />}
    </div>
  );
}

function Card({ titulo, valor, cor = 'text-slate-700', sub }: { titulo: string; valor: string; cor?: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{titulo}</div>
      <div className={`mt-1 text-lg font-bold ${cor}`}>{valor}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
function Dot({ c }: { c: string }) { return <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />; }

function CustosFixosModal({ custos, onFechar, onMudou }: { custos: { id: string; nome: string; escopo: string; valor: number; ativo: boolean }[]; onFechar: () => void; onMudou: () => void }) {
  const toast = useToast();
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [empresas, setEmpresas] = useState<{ id: string; razaoSocial: string }[]>([]);
  const [f, setF] = useState({ nome: '', escopo: 'GERAL' as 'GERAL' | 'GRUPO' | 'TAG' | 'EMPRESA', grupoId: '', tagId: '', empresaId: '', valor: '' });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
    api.get<{ items: { id: string; razaoSocial: string }[] }>('/empresas?limit=500').then((r) => setEmpresas(r.items)).catch(() => undefined);
  }, []);

  async function adicionar() {
    if (!f.nome.trim() || !f.valor) return toast('erro', 'Informe nome e valor.');
    setSalvando(true);
    try {
      await api.post('/apla/custos-fixos', {
        nome: f.nome.trim(), escopo: f.escopo, valor: Number(f.valor),
        grupoId: f.grupoId || undefined, tagId: f.tagId || undefined, empresaId: f.empresaId || undefined,
      });
      setF({ nome: '', escopo: 'GERAL', grupoId: '', tagId: '', empresaId: '', valor: '' });
      toast('ok', 'Custo fixo adicionado.'); onMudou();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }
  async function remover(id: string) {
    if (!confirm('Remover este custo fixo?')) return;
    try { await api.del(`/apla/custos-fixos/${id}`); toast('ok', 'Removido.'); onMudou(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <Modal aberto titulo="Custos fixos (rateados na lucratividade)" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">GERAL rateia entre todas as empresas; GRUPO/TAG entre os membros; EMPRESA aplica direto.</p>
        <div className="grid grid-cols-2 gap-2">
          <input className="input col-span-2" placeholder="Nome (ex.: Aluguel)" value={f.nome} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
          <select className="input" value={f.escopo} onChange={(e) => setF((s) => ({ ...s, escopo: e.target.value as never, grupoId: '', tagId: '', empresaId: '' }))}>
            <option value="GERAL">Toda a empresa</option>
            <option value="GRUPO">Grupo de empresas</option>
            <option value="TAG">Tag</option>
            <option value="EMPRESA">Empresa especifica</option>
          </select>
          <input className="input" type="number" min={0} step="0.01" placeholder="Valor (R$/mes)" value={f.valor} onChange={(e) => setF((s) => ({ ...s, valor: e.target.value }))} />
          {f.escopo === 'GRUPO' && (
            <select className="input col-span-2" value={f.grupoId} onChange={(e) => setF((s) => ({ ...s, grupoId: e.target.value }))}>
              <option value="">Selecione o grupo</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          )}
          {f.escopo === 'TAG' && (
            <select className="input col-span-2" value={f.tagId} onChange={(e) => setF((s) => ({ ...s, tagId: e.target.value }))}>
              <option value="">Selecione a tag</option>{tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          {f.escopo === 'EMPRESA' && (
            <select className="input col-span-2" value={f.empresaId} onChange={(e) => setF((s) => ({ ...s, empresaId: e.target.value }))}>
              <option value="">Selecione a empresa</option>{empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.razaoSocial}</option>)}
            </select>
          )}
        </div>
        <button className="btn-primary w-full" onClick={adicionar} disabled={salvando}>{salvando ? 'Salvando...' : '+ Adicionar custo fixo'}</button>

        <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
          {custos.length === 0 && <p className="p-3 text-sm text-slate-400">Nenhum custo fixo cadastrado.</p>}
          {custos.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-slate-700">{c.nome} <span className="text-xs text-slate-400">({c.escopo})</span></span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-600">{brl(c.valor)}</span>
                <button className="text-slate-400 hover:text-red-500" onClick={() => remover(c.id)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end"><button className="btn-ghost" onClick={onFechar}>Fechar</button></div>
      </div>
    </Modal>
  );
}
