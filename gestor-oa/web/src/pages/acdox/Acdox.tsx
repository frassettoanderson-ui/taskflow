import { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Pencil, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Modal, Spinner, useToast } from '../../components/ui';
import type { ReguaCobranca, CobrancaLista, CobrancaDetalhe, AcdoxDashboard, Departamento } from '../../lib/tipos';

const ABAS = ['Cobrancas', 'Reguas de cobranca'] as const;
const COR_STATUS: Record<string, string> = { PENDENTE: '#f0ad4e', VENCIDO: '#cf3c5d', RECEBIDO: '#5b9bd5', VALIDADO: '#5cb85c', RECUSADO: '#94a3b8' };
const dataBR = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export default function Acdox() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeConfig = !!sessao?.usuario.permissoes['documentos_upload'];
  const hoje = new Date();
  const [aba, setAba] = useState(0);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [status, setStatus] = useState('');
  const [dash, setDash] = useState<AcdoxDashboard | null>(null);
  const [cobrancas, setCobrancas] = useState<CobrancaLista[]>([]);
  const [reguas, setReguas] = useState<ReguaCobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);

  function carregar() {
    setLoading(true);
    const qs = `ano=${ano}&mes=${mes}${status ? `&status=${status}` : ''}`;
    Promise.all([
      api.get<AcdoxDashboard>(`/acdox/dashboard?ano=${ano}&mes=${mes}`).then(setDash),
      api.get<CobrancaLista[]>(`/acdox/cobrancas?${qs}`).then(setCobrancas),
      api.get<ReguaCobranca[]>('/acdox/reguas').then(setReguas),
    ]).finally(() => setLoading(false));
  }
  useEffect(carregar, [ano, mes, status]);

  async function gerar() {
    if (!confirm(`Gerar cobrancas das reguas ativas para ${String(mes).padStart(2, '0')}/${ano}?`)) return;
    try { const r = await api.post<{ criadas: number }>('/acdox/gerar', { ano, mes }); toast('ok', `${r.criadas} cobranca(s) gerada(s).`); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  const [editRegua, setEditRegua] = useState<ReguaCobranca | null>(null);
  const [novaRegua, setNovaRegua] = useState(false);
  async function removerRegua(r: ReguaCobranca) {
    if (!confirm(`Excluir a regua "${r.nome}"? Remove tambem as cobrancas geradas.`)) return;
    try { await api.del(`/acdox/reguas/${r.id}`); toast('ok', 'Regua excluida.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800"><FileText size={22} /> Acessorias DOCS</h1>
          <p className="text-sm text-slate-500">Cobranca recorrente de documentos do cliente (regua de cobranca).</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-24" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
          </select>
          <select className="input w-28" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {podeConfig && <button className="btn-ghost border border-slate-300" onClick={gerar}><RefreshCw size={15} /> Gerar competencia</button>}
        </div>
      </div>

      {/* dashboard donut/cards */}
      {dash && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <CardStatus titulo="Total" valor={dash.total} cor="#64748b" ativo={status === ''} onClick={() => setStatus('')} />
          <CardStatus titulo="Pendentes" valor={dash.PENDENTE} cor={COR_STATUS.PENDENTE} ativo={status === 'PENDENTE'} onClick={() => setStatus('PENDENTE')} />
          <CardStatus titulo="Vencidos" valor={dash.VENCIDO} cor={COR_STATUS.VENCIDO} ativo={status === 'VENCIDO'} onClick={() => setStatus('VENCIDO')} />
          <CardStatus titulo="Recebidos" valor={dash.RECEBIDO} cor={COR_STATUS.RECEBIDO} ativo={status === 'RECEBIDO'} onClick={() => setStatus('RECEBIDO')} />
          <CardStatus titulo="Validados" valor={dash.VALIDADO} cor={COR_STATUS.VALIDADO} ativo={status === 'VALIDADO'} onClick={() => setStatus('VALIDADO')} />
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {ABAS.map((a, i) => (
          <button key={a} onClick={() => setAba(i)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${aba === i ? 'border-marca-500 text-marca-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{a}</button>
        ))}
      </div>

      {loading ? <Spinner /> : aba === 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Regua</th><th className="px-3 py-2">Competencia</th><th className="px-3 py-2">Limite</th><th className="px-3 py-2">Docs</th><th className="px-3 py-2">Status</th></tr>
            </thead>
            <tbody>
              {cobrancas.map((c) => (
                <tr key={c.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setAberta(c.id)}>
                  <td className="px-3 py-2 font-medium text-marca-700">{c.empresa} <span className="text-xs text-slate-400">[{c.empresaNumero ?? '-'}]</span></td>
                  <td className="px-3 py-2 text-slate-500">{c.reguaNome}</td>
                  <td className="px-3 py-2 text-slate-500">{c.competencia}</td>
                  <td className="px-3 py-2 text-slate-500">{dataBR(c.dataLimite)}</td>
                  <td className="px-3 py-2 text-slate-500">{(c.porStatus.VALIDADO ?? 0) + (c.porStatus.RECEBIDO ?? 0)}/{c.totalItens}</td>
                  <td className="px-3 py-2"><span className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ background: COR_STATUS[c.status] }}>{c.status}</span></td>
                </tr>
              ))}
              {cobrancas.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Nenhuma cobranca. Use "Gerar competencia" apos cadastrar reguas.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {podeConfig && <button className="btn-primary flex items-center gap-2" onClick={() => setNovaRegua(true)}><Plus size={16} /> Nova regua</button>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reguas.map((r) => (
              <div key={r.id} className="card space-y-2 p-4">
                <div className="flex items-start justify-between">
                  <h2 className="font-semibold text-marca-700">{r.nome}</h2>
                  {podeConfig && (
                    <div className="flex gap-1">
                      <button className="text-slate-400 hover:text-marca-600" onClick={() => setEditRegua(r)}><Pencil size={15} /></button>
                      <button className="text-slate-400 hover:text-red-500" onClick={() => removerRegua(r)}><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">Dia limite {r.diaLimite} · {r.itens.length} doc(s) · {r.empresasCount} empresa(s) · {r.cobrancasCount} cobranca(s){r.ativo ? '' : ' · inativa'}</p>
                <div className="flex flex-wrap gap-1">{r.itens.map((i) => <span key={i.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{i.nome}</span>)}</div>
              </div>
            ))}
            {reguas.length === 0 && <p className="col-span-full py-10 text-center text-slate-400">Nenhuma regua cadastrada.</p>}
          </div>
        </div>
      )}

      {aberta && <CobrancaModal id={aberta} podeConfig={podeConfig} onFechar={() => setAberta(null)} onMudou={carregar} />}
      {(novaRegua || editRegua) && <ReguaForm inicial={editRegua} onFechar={() => { setNovaRegua(false); setEditRegua(null); }} onFeito={() => { setNovaRegua(false); setEditRegua(null); carregar(); }} />}
    </div>
  );
}

function CardStatus({ titulo, valor, cor, ativo, onClick }: { titulo: string; valor: number; cor: string; ativo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`card p-3 text-left ${ativo ? 'ring-2 ring-marca-400' : ''}`}>
      <div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: cor }} />{titulo}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color: cor }}>{valor}</div>
    </button>
  );
}

function CobrancaModal({ id, podeConfig, onFechar, onMudou }: { id: string; podeConfig: boolean; onFechar: () => void; onMudou: () => void }) {
  const toast = useToast();
  const [c, setC] = useState<CobrancaDetalhe | null>(null);
  function carregar() { api.get<CobrancaDetalhe>(`/acdox/cobrancas/${id}`).then(setC); }
  useEffect(carregar, [id]);

  async function acao(itemId: string, tipo: 'receber' | 'validar' | 'recusar', file?: File) {
    const fd = new FormData(); fd.append('acao', tipo);
    if (tipo === 'recusar') { const j = prompt('Motivo da recusa:'); if (j === null) return; fd.append('justificativa', j); }
    if (file) fd.append('arquivo', file);
    try { const r = await api.upload<CobrancaDetalhe>(`/acdox/cobrancas/${id}/itens/${itemId}/acao`, fd); setC(r); onMudou(); toast('ok', 'Atualizado.'); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (!c) return <Modal aberto titulo="Cobranca" onFechar={onFechar}><Spinner /></Modal>;
  return (
    <Modal aberto titulo={`${c.empresa} · ${c.competencia}`} onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">{c.reguaNome} · limite {dataBR(c.dataLimite)} · <span className="font-medium" style={{ color: COR_STATUS[c.status] }}>{c.status}</span></p>
        <div className="divide-y divide-slate-100 rounded border border-slate-200">
          {c.itens.map((it) => (
            <div key={it.id} className="space-y-1 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{it.nome}</span>
                <span className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ background: COR_STATUS[it.status] ?? '#94a3b8' }}>{it.status}</span>
              </div>
              {it.arquivo && <p className="text-xs text-emerald-600">Documento anexado</p>}
              {it.justificativa && <p className="text-xs text-red-500">Recusa: {it.justificativa}</p>}
              {podeConfig && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="cursor-pointer text-xs text-marca-600 hover:underline">
                    Upload manual<input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && acao(it.id, 'receber', e.target.files[0])} />
                  </label>
                  <button className="flex items-center gap-1 text-xs text-emerald-600 hover:underline" onClick={() => acao(it.id, 'validar')}><CheckCircle2 size={13} /> Validar</button>
                  <button className="flex items-center gap-1 text-xs text-red-500 hover:underline" onClick={() => acao(it.id, 'recusar')}><XCircle size={13} /> Recusar</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end"><button className="btn-ghost" onClick={onFechar}>Fechar</button></div>
      </div>
    </Modal>
  );
}

function ReguaForm({ inicial, onFechar, onFeito }: { inicial: ReguaCobranca | null; onFechar: () => void; onFeito: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [diaLimite, setDiaLimite] = useState(inicial?.diaLimite ?? 10);
  const [lembreteAntes, setLembreteAntes] = useState(inicial?.lembreteAntesDias ?? 5);
  const [lembreteDepois, setLembreteDepois] = useState(inicial?.lembreteDepoisDias ?? 3);
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [itensTxt, setItensTxt] = useState((inicial?.itens ?? []).map((i) => i.nome).join('\n'));
  const [empresaIds, setEmpresaIds] = useState<string[]>([]);
  const [empresas, setEmpresas] = useState<{ id: string; razaoSocial: string }[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [departamentoId, setDepartamentoId] = useState(inicial?.departamentoId ?? '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<{ items: { id: string; razaoSocial: string }[] }>('/empresas?limit=500').then((r) => setEmpresas(r.items)).catch(() => undefined);
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    if (inicial) api.get<{ empresaIds: string[] }>(`/acdox/reguas/${inicial.id}`).then((r) => setEmpresaIds(r.empresaIds)).catch(() => undefined);
  }, [inicial]);

  async function salvar() {
    const itens = itensTxt.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!nome.trim()) return toast('erro', 'Informe o nome.');
    if (itens.length === 0) return toast('erro', 'Liste ao menos um documento a cobrar.');
    setSalvando(true);
    const payload = { nome: nome.trim(), diaLimite, departamentoId: departamentoId || null, lembreteAntesDias: lembreteAntes, lembreteDepoisDias: lembreteDepois, ativo, itens, empresaIds };
    try {
      if (inicial) await api.put(`/acdox/reguas/${inicial.id}`, payload);
      else await api.post('/acdox/reguas', payload);
      toast('ok', 'Regua salva.'); onFeito();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={inicial ? 'Editar regua' : 'Nova regua de cobranca'} onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Nome da regua</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Documentos contabeis mensais" /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="label">Dia limite</label><input className="input" type="number" min={1} max={31} value={diaLimite} onChange={(e) => setDiaLimite(Number(e.target.value))} /></div>
          <div><label className="label">Lembrar antes (dias)</label><input className="input" type="number" min={0} value={lembreteAntes} onChange={(e) => setLembreteAntes(Number(e.target.value))} /></div>
          <div><label className="label">Cobrar apos (dias)</label><input className="input" type="number" min={0} value={lembreteDepois} onChange={(e) => setLembreteDepois(Number(e.target.value))} /></div>
        </div>
        <div>
          <label className="label">Departamento (opcional)</label>
          <select className="input" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
            <option value="">Nenhum</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Documentos a cobrar (um por linha)</label>
          <textarea className="input" rows={4} value={itensTxt} onChange={(e) => setItensTxt(e.target.value)} placeholder={'Extrato bancario\nNotas de entrada\nNotas de saida'} />
        </div>
        <div>
          <label className="label">Empresas ({empresaIds.length} selecionada(s))</label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
            {empresas.map((e) => (
              <label key={e.id} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" checked={empresaIds.includes(e.id)} onChange={() => setEmpresaIds((s) => s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id])} />
                {e.razaoSocial}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Regua ativa</label>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button></div>
      </div>
    </Modal>
  );
}
