import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, FileText, Pencil, Settings } from 'lucide-react';
import { api, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { AssinaturaDocumento, Obrigacao } from '../../lib/tipos';

const shortEnvia = (v?: string) => { const x = (v ?? 'Imediato').replace('Sim - ', ''); return x === 'Nao' ? 'Nao' : x; };
const shortReenvio = (v?: string) => !v ? 'Rep.D.A.A.' : /mant/i.test(v) ? 'Rep.M.A.A.' : /desativa/i.test(v) ? 'Rep.D.A.A.' : v;
const fullReenvio = (v?: string) => !v ? 'Reprocessa e desativa arquivos anteriores' : /mant/i.test(v) ? 'Reprocessa e mantem arquivos anteriores' : /desativa/i.test(v) ? 'Reprocessa e desativa arquivos anteriores' : v;
const shortSemDemanda = (v?: string) => !v ? 'Cria' : /ignor/i.test(v) ? 'Ignora' : /criar/i.test(v) ? 'Cria' : v;

export default function Assinaturas() {
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [itens, setItens] = useState<AssinaturaDocumento[]>([]);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [office, setOffice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);

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
    if (selecionados.length === 0) return itens;
    return itens.filter((a) => selecionados.includes(a.obrigacaoNome));
  }, [itens, selecionados]);

  const opcoes = useMemo(() => {
    const nomes = new Set<string>([...obrigacoes.map((o) => o.nome), ...itens.map((i) => i.obrigacaoNome)]);
    const q = busca.trim().toLowerCase();
    return [...nomes].filter((n) => n && !selecionados.includes(n) && (!q || n.toLowerCase().includes(q))).sort((a, b) => a.localeCompare(b));
  }, [obrigacoes, itens, busca, selecionados]);

  async function verExemplo(a: AssinaturaDocumento) {
    if (!a.exemploArquivo) { toast('erro', 'Essa entrega ainda nao tem PDF de exemplo. Edite e anexe um.'); return; }
    try {
      const res = await fetch(`/api/v1/assinaturas/${a.id}/exemplo`, { headers: { Authorization: `Bearer ${getAccessToken()}` }, credentials: 'include' });
      if (!res.ok) throw new Error();
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch { toast('erro', 'Nao foi possivel abrir o exemplo.'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-fundo p-5 text-[13px]">
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

      {/* Combobox multi de obrigacoes + filtrar */}
      <div className="mb-3 flex items-start gap-3">
        <div className="relative flex-1">
          <div className="flex flex-wrap items-center gap-1 rounded border border-marca-300 bg-white px-2 py-1.5">
            {selecionados.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[12px] text-slate-600">
                <button onClick={() => setSelecionados((x) => x.filter((y) => y !== s))} className="text-slate-400 hover:text-red-500">×</button>{s}
              </span>
            ))}
            <input
              className="min-w-[180px] flex-1 bg-transparent text-[13px] outline-none"
              placeholder={selecionados.length ? '' : 'Localizar na base de conhecimento'}
              value={busca}
              onFocus={() => setAberto(true)}
              onBlur={() => setTimeout(() => setAberto(false), 150)}
              onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
            />
          </div>
          {aberto && opcoes.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
              {opcoes.map((o) => (
                <button key={o} onMouseDown={(e) => e.preventDefault()} onClick={() => { setSelecionados((x) => [...x, o]); setBusca(''); }}
                  className="block w-full px-3 py-1.5 text-left text-[13px] text-marca-700 hover:bg-marca-500 hover:text-white">{o}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center px-1 py-2 text-[13px] text-marca-600">Listando {filtrados.length} registro(s)</div>
        <button onClick={() => setAberto(false)} className="flex items-center gap-2 rounded bg-status-ok px-6 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={15} /> Filtrar</button>
      </div>

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
                  <button onClick={() => navigate(`/robo/assinaturas/${a.id}`)} className="text-status-danger hover:underline">{a.nome}</button>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <button onClick={() => verExemplo(a)} title="Visualizar exemplo de guia que e reconhecida nesse entrega" className={a.exemploArquivo ? 'text-status-ok hover:opacity-70' : 'text-slate-300'}><FileText size={15} /></button>
                    <button onClick={() => navigate(`/robo/assinaturas/${a.id}`)} title="Editar obrigacoes correspondentes" className="text-marca-500 hover:text-marca-700"><Pencil size={13} /></button>
                    {a.obrigacaoNome}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{shortEnvia(a.enviaEmail)}</td>
                <td className="px-4 py-2.5 text-slate-600">{a.copiaLocal === false ? 'Nao' : 'Sim'}</td>
                <td className="cursor-help px-4 py-2.5 text-slate-600" title={fullReenvio(a.aoReenviar)}>{shortReenvio(a.aoReenviar)}</td>
                <td className="px-4 py-2.5 text-slate-600">{shortSemDemanda(a.semDemanda)}</td>
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
        <button onClick={() => navigate('/robo/assinaturas/novo')} title="Nova entrega automatizada"
          className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-marca-500 text-white shadow-lg hover:bg-marca-600">
          <Plus size={22} />
        </button>
      )}
    </div>
  );
}
