import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, FileText, Pencil, Settings } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Modal, Spinner, useToast } from '../../components/ui';
import type { AssinaturaDocumento, Obrigacao } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 block text-[12px] font-medium text-slate-600';

const OPC_ENVIA = ['Imediato', 'Agendado', 'Nao'];
const OPC_REENVIAR = ['Rep.D.A.A.', 'Rep.M.A.A.'];
const OPC_SEM_DEMANDA = ['Cria', 'Ignora'];

export default function Assinaturas() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [itens, setItens] = useState<AssinaturaDocumento[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [office, setOffice] = useState('');
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<AssinaturaDocumento | null>(null);
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');

  function carregar() {
    setLoading(true);
    api.get<AssinaturaDocumento[]>('/assinaturas').then(setItens).catch(() => setItens([])).finally(() => setLoading(false));
  }
  useEffect(() => {
    carregar();
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
    api.get<{ nome: string }>('/escritorio').then((e) => setOffice(e.nome)).catch(() => undefined);
  }, []);

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((a) => a.nome.toLowerCase().includes(q) || a.obrigacaoNome.toLowerCase().includes(q));
  }, [itens, filtro]);

  async function excluir(a: AssinaturaDocumento) {
    if (!confirm(`Excluir "${a.nome}"?`)) return;
    try { await api.del(`/assinaturas/${a.id}`); toast('ok', 'Excluida.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
      {/* Cabecalho */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Settings size={16} className="text-slate-400" />
          <span>Sistema</span><span className="text-slate-300">›</span>
          <span>e-Continuo</span><span className="text-slate-300">›</span>
          <span className="text-slate-700">Base de conhecimento do e-Continuo, o robo do Sistema Acessorias</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      {/* Barra de busca + filtrar */}
      <div className="mb-1 flex items-stretch gap-3">
        <input
          className="flex-1 rounded border border-marca-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-marca-500"
          placeholder="Localizar na base de conhecimento"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setFiltro(busca); }}
        />
        <div className="flex items-center px-2 text-[13px] text-marca-600">Listando {filtrados.length} registro(s)</div>
        <button onClick={() => setFiltro(busca)} className="flex items-center gap-2 rounded bg-status-ok px-6 text-sm font-medium text-white hover:bg-emerald-600">
          <Search size={15} /> Filtrar
        </button>
      </div>
      {filtro && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[12px] text-slate-600">
            <button onClick={() => { setFiltro(''); setBusca(''); }} className="text-slate-400 hover:text-red-500">×</button>{filtro}
          </span>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-status-danger">
              <th className="px-4 py-2.5">Descricao da entrega automatizada</th>
              <th className="px-4 py-2.5">Obrigacao correspondente</th>
              <th className="px-4 py-2.5">Envia e-mail?</th>
              <th className="px-4 py-2.5">Copia local?</th>
              <th className="px-4 py-2.5">Ao reenviar</th>
              <th className="px-4 py-2.5">Sem demanda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <button onClick={() => podeGerenciar ? setEditando(a) : undefined} className="text-status-danger hover:underline">{a.nome}</button>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <FileText size={14} className="text-status-ok" />
                    {podeGerenciar && <button onClick={() => setEditando(a)} className="text-marca-500 hover:text-marca-700"><Pencil size={13} /></button>}
                    {a.obrigacaoNome}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{a.enviaEmail ?? 'Imediato'}</td>
                <td className="px-4 py-2.5 text-slate-600">{a.copiaLocal === false ? 'Nao' : 'Sim'}</td>
                <td className="px-4 py-2.5 text-slate-600">{a.aoReenviar ?? 'Rep.D.A.A.'}</td>
                <td className="px-4 py-2.5 text-slate-600">{a.semDemanda ?? 'Cria'}</td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nenhum registro na base de conhecimento.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Rodape */}
      <div className="mt-6 flex items-center justify-between border-t border-marca-200 pt-2 text-[12px] text-marca-600">
        <span>Usuario: {sessao?.usuario?.nome ?? '—'}</span>
        <span>Office: {office || '—'}</span>
      </div>

      {/* FAB novo */}
      {podeGerenciar && (
        <button onClick={() => setNovo(true)} title="Nova entrega automatizada"
          className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-marca-500 text-white shadow-lg hover:bg-marca-600">
          <Plus size={22} />
        </button>
      )}

      {(novo || editando) && (
        <AssinaturaModal assinatura={editando} obrigacoes={obrigacoes} onFechar={() => { setNovo(false); setEditando(null); }} onSalvo={() => { setNovo(false); setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

function AssinaturaModal({ assinatura, obrigacoes, onFechar, onSalvo }: {
  assinatura: AssinaturaDocumento | null; obrigacoes: Obrigacao[]; onFechar: () => void; onSalvo: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(assinatura?.nome ?? '');
  const [obrigacaoNome, setObrigacaoNome] = useState(assinatura?.obrigacaoNome ?? '');
  const [palavras, setPalavras] = useState((assinatura?.palavras ?? []).join('\n'));
  const [regexCompetencia, setRegexCompetencia] = useState(assinatura?.regexCompetencia ?? '');
  const [ativo, setAtivo] = useState(assinatura?.ativo ?? true);
  const [enviaEmail, setEnviaEmail] = useState(assinatura?.enviaEmail ?? 'Imediato');
  const [copiaLocal, setCopiaLocal] = useState(assinatura?.copiaLocal ?? true);
  const [aoReenviar, setAoReenviar] = useState(assinatura?.aoReenviar ?? 'Rep.D.A.A.');
  const [semDemanda, setSemDemanda] = useState(assinatura?.semDemanda ?? 'Cria');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const payload = {
        nome, obrigacaoNome,
        palavras: palavras.split('\n').map((p) => p.trim()).filter(Boolean),
        regexCompetencia: regexCompetencia || null, ativo,
        enviaEmail, copiaLocal, aoReenviar, semDemanda,
      };
      if (assinatura) await api.put(`/assinaturas/${assinatura.id}`, payload);
      else await api.post('/assinaturas', payload);
      toast('ok', 'Salvo.');
      onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={assinatura ? 'Editar entrega automatizada' : 'Nova entrega automatizada'} onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className={LBL}>Descricao da entrega automatizada</label><input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="[PRESUMIDO] DARE (SC - IE - Cod. 1449)" /></div>
        <div>
          <label className={LBL}>Obrigacao correspondente</label>
          <select className={INP} value={obrigacaoNome} onChange={(e) => setObrigacaoNome(e.target.value)}>
            <option value="">Selecione</option>
            {obrigacoes.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LBL}>Envia e-mail?</label>
            <select className={INP} value={enviaEmail} onChange={(e) => setEnviaEmail(e.target.value)}>{OPC_ENVIA.map((o) => <option key={o}>{o}</option>)}</select>
          </div>
          <div>
            <label className={LBL}>Copia local?</label>
            <select className={INP} value={copiaLocal ? 'Sim' : 'Nao'} onChange={(e) => setCopiaLocal(e.target.value === 'Sim')}><option>Sim</option><option>Nao</option></select>
          </div>
          <div>
            <label className={LBL}>Ao reenviar</label>
            <select className={INP} value={aoReenviar} onChange={(e) => setAoReenviar(e.target.value)}>{OPC_REENVIAR.map((o) => <option key={o}>{o}</option>)}</select>
          </div>
          <div>
            <label className={LBL}>Sem demanda</label>
            <select className={INP} value={semDemanda} onChange={(e) => setSemDemanda(e.target.value)}>{OPC_SEM_DEMANDA.map((o) => <option key={o}>{o}</option>)}</select>
          </div>
        </div>
        <div>
          <label className={LBL}>Assinaturas / palavras-chave (uma por linha — todas devem casar)</label>
          <textarea className={`${INP} font-mono`} rows={4} value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder={'DARE\nICMS'} />
        </div>
        <div>
          <label className={LBL}>Regex da competencia (opcional)</label>
          <input className={`${INP} font-mono`} value={regexCompetencia} onChange={(e) => setRegexCompetencia(e.target.value)} placeholder="periodo de apuracao\\s*:?\\s*(\\d{2}/\\d{4})" />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-slate-600"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativa</label>
        <div className="flex justify-between gap-2 pt-1">
          <div>
            {assinatura && <button className="text-[12px] text-red-500 hover:underline" onClick={() => { onFechar(); }}>Fechar</button>}
          </div>
          <div className="flex gap-2">
            <button className="rounded bg-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-300" onClick={onFechar}>Cancelar</button>
            <button className="rounded bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
