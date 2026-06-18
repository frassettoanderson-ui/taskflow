import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, RotateCcw, FileText, History, Settings } from 'lucide-react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { Spinner, useToast } from '../../components/ui';
import type { AssinaturaDocumento, Obrigacao } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 flex items-center gap-1 text-[12px] font-medium text-slate-600';

const ENVIA = ['Nao', 'Sim - Imediato', 'Sim - Agendado', 'Sim - Pre-agendado', 'Sim - Aos gestores do dpto'];
const REENVIAR = ['Ignorar', 'Reprocessa e mantem arquivos anteriores', 'Reprocessa e desativa arquivos anteriores'];
const SEM_DEMANDA = ['Ignorar', 'Criar entrega/demanda'];
// secao de reconhecimento do robo escondida por ora (sera tratada junto do robo no final)
const MOSTRAR_ROBO = false;

const INFO_ANTECIPADO = `Caso o documento tenha vencimento no padrao homologado, sera exibido pelo campo padrao no e-mail.
Obs: Se o vencimento no documento tenha sofrido alteracao no local de exibicao com relacao ao padrao (casos de guias emitidas diretamente por sites do governo por exemplo), recomendamos que a entrega seja feita pelo menu Lista de Entregas onde a data de vencimento pode ser definida manualmente.`;

function Info({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-marca-100 text-[9px] font-bold text-marca-600 ${onClick ? 'cursor-pointer hover:bg-marca-200' : ''}`}>i</button>
  );
}

export default function AssinaturaForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);

  const [nome, setNome] = useState('');
  const [copiaLocal, setCopiaLocal] = useState(true);
  const [enviaEmail, setEnviaEmail] = useState('Sim - Imediato');
  const [miniNomeLocal, setMiniNomeLocal] = useState('');
  const [caminhoLocal, setCaminhoLocal] = useState('');
  const [aoReenviar, setAoReenviar] = useState('Reprocessa e desativa arquivos anteriores');
  const [semDemanda, setSemDemanda] = useState('Criar entrega/demanda');
  const [anteciparVcto, setAnteciparVcto] = useState(true);
  const [msgAlerta, setMsgAlerta] = useState('');
  const [consideraVcto, setConsideraVcto] = useState(true);
  const [correspondentes, setCorrespondentes] = useState<string[]>([]);
  // recursos nossos (reconhecimento do robo)
  const [palavras, setPalavras] = useState('');
  const [regexCompetencia, setRegexCompetencia] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [temExemplo, setTemExemplo] = useState(false);
  const [mostrarLog, setMostrarLog] = useState(false);
  const [infoTexto, setInfoTexto] = useState<string | null>(null);

  useEffect(() => {
    api.get<Obrigacao[]>('/obrigacoes').then(setObrigacoes).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (novo) return;
    api.get<AssinaturaDocumento>(`/assinaturas/${id}`).then((a) => {
      setNome(a.nome); setCopiaLocal(a.copiaLocal ?? true); setEnviaEmail(a.enviaEmail ?? 'Sim - Imediato');
      setMiniNomeLocal(a.miniNomeLocal ?? ''); setCaminhoLocal(a.caminhoLocal ?? '');
      setAoReenviar(a.aoReenviar ?? 'Reprocessa e desativa arquivos anteriores'); setSemDemanda(a.semDemanda ?? 'Criar entrega/demanda');
      setAnteciparVcto(a.anteciparVcto ?? true); setMsgAlerta(a.msgAlertaAntecipado ?? '');
      setConsideraVcto(a.consideraVcto ?? true);
      setCorrespondentes(a.obrigacoesCorrespondentes ?? (a.obrigacaoNome ? [a.obrigacaoNome] : []));
      setPalavras((a.palavras ?? []).join('\n')); setRegexCompetencia(a.regexCompetencia ?? '');
      setAtivo(a.ativo ?? true); setTemExemplo(!!a.exemploArquivo);
    }).catch(() => toast('erro', 'Entrega nao encontrada.')).finally(() => setCarregando(false));
  }, [id, novo]);

  // assinaturas que ainda nao tem id usam a primeira obrigacao como referencia para buscar /assinaturas (sem listar). Carregamos so na edicao.

  async function verExemplo() {
    if (!id || !temExemplo) { toast('erro', 'Sem PDF de exemplo. Anexe abaixo.'); return; }
    try {
      const res = await fetch(`/api/v1/assinaturas/${id}/exemplo`, { headers: { Authorization: `Bearer ${getAccessToken()}` }, credentials: 'include' });
      if (!res.ok) throw new Error();
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch { toast('erro', 'Nao foi possivel abrir o exemplo.'); }
  }
  async function enviarExemplo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const fd = new FormData(); fd.append('arquivo', file);
    try { await api.upload(`/assinaturas/${id}/exemplo`, fd); setTemExemplo(true); toast('ok', 'Exemplo anexado.'); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro (use PDF).'); }
  }

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe a descricao da entrega.');
    setSalvando(true);
    try {
      const payload = {
        nome, copiaLocal, enviaEmail, miniNomeLocal: miniNomeLocal || null,
        caminhoLocal: caminhoLocal || null, aoReenviar, semDemanda,
        anteciparVcto, msgAlertaAntecipado: msgAlerta || null, consideraVcto,
        obrigacoesCorrespondentes: correspondentes,
        palavras: palavras.split('\n').map((p) => p.trim()).filter(Boolean),
        regexCompetencia: regexCompetencia || null, ativo,
      };
      if (novo) await api.post('/assinaturas', payload);
      else await api.put(`/assinaturas/${id}`, payload);
      toast('ok', 'Salvo.');
      navigate('/robo/assinaturas');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  const disponiveis = obrigacoes.map((o) => o.nome).filter((n) => !correspondentes.includes(n));

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Settings size={16} className="text-slate-400" />
        <span>Sistema</span><span className="text-slate-300">›</span>
        <span>e-Continuo</span><span className="text-slate-300">›</span>
        <span className="text-slate-700">Editar obrigacoes correspondentes</span>
      </div>

      {/* Linha 1 */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-4">
        <div>
          <label className={LBL}>Obrigacao correspondente a automacao:</label>
          <div className="flex items-center gap-1.5">
            {novo ? (
              <input className={`${INP} text-status-danger`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="DARE (SC - IE - Cod. 1449)" />
            ) : (
              <span className="flex-1 truncate py-1 font-medium text-status-danger" title={nome}>{nome || '—'}</span>
            )}
            <button onClick={verExemplo} title="Visualizar exemplo de guia reconhecida" className={temExemplo ? 'text-status-ok hover:opacity-70' : 'text-slate-300'}><FileText size={16} /></button>
            <button onClick={() => setMostrarLog((v) => !v)} title="Listar log's de alteracao" className={mostrarLog ? 'text-marca-600' : 'text-slate-400 hover:text-marca-600'}><History size={15} /></button>
          </div>
        </div>
        <div>
          <label className={LBL}>Faz copia local?</label>
          <select className={INP} value={copiaLocal ? 'Sim' : 'Nao'} onChange={(e) => setCopiaLocal(e.target.value === 'Sim')}><option>Sim</option><option>Nao</option></select>
        </div>
        <div>
          <label className={LBL}>Envia e-mail? <Info /></label>
          <select className={INP} value={enviaEmail} onChange={(e) => setEnviaEmail(e.target.value)}>{ENVIA.map((o) => <option key={o}>{o}</option>)}</select>
        </div>
        <div>
          <label className={LBL}>Mini-Nome local</label>
          <input className={INP} value={miniNomeLocal} onChange={(e) => setMiniNomeLocal(e.target.value)} placeholder="PRESUMIDO" />
        </div>
      </div>

      {/* Linha 2 */}
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3">
        <div>
          <label className={LBL}>Caminho local (Pastas para Salvar) <Info /></label>
          <input className={INP} value={caminhoLocal} onChange={(e) => setCaminhoLocal(e.target.value)} placeholder="Em branco = '[Empresa]/[DocTipo]/[DocCompAno]-[DocCompMes]_[DocNome]'" />
        </div>
        <div>
          <label className={LBL}>Procedimento ao reenviar?</label>
          <select className={INP} value={aoReenviar} onChange={(e) => setAoReenviar(e.target.value)}>{REENVIAR.map((o) => <option key={o}>{o}</option>)}</select>
        </div>
        <div>
          <label className={LBL}>Caso n tenha demanda na cpt.</label>
          <select className={INP} value={semDemanda} onChange={(e) => setSemDemanda(e.target.value)}>{SEM_DEMANDA.map((o) => <option key={o}>{o}</option>)}</select>
        </div>
      </div>

      {/* Linha 3 */}
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <div>
          <label className={LBL}>Antecipar data de vencimento em dias nao-uteis? <Info /></label>
          <select className={INP} value={anteciparVcto ? 'Sim' : 'Nao'} onChange={(e) => setAnteciparVcto(e.target.value === 'Sim')}><option>Sim</option><option>Nao</option></select>
        </div>
        <div>
          <label className={LBL}>Mensagem de alerta de pagamento antecipado no e-mail <Info onClick={() => setInfoTexto(INFO_ANTECIPADO)} /></label>
          <input className={INP} value={msgAlerta} onChange={(e) => setMsgAlerta(e.target.value)} placeholder="Em branco = 'Atencao! Pagamento precisa ser antecipado!'" />
        </div>
      </div>

      {/* Linha 4: obrigacoes correspondentes + considera vcto + acoes */}
      <div className="mt-3 grid grid-cols-1 items-end gap-x-6 gap-y-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className={LBL}>Obrigacoes correspondentes: <Info /></label>
          <div className="rounded border border-slate-300 bg-white p-1.5">
            <div className="mb-1 flex flex-wrap gap-1">
              {correspondentes.length === 0 && <span className="px-1 text-[11px] text-slate-400">Nenhuma selecionada</span>}
              {correspondentes.map((o) => (
                <span key={o} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[12px] text-slate-600">
                  <button onClick={() => setCorrespondentes((c) => c.filter((x) => x !== o))} className="text-slate-400 hover:text-red-500">×</button>{o}
                </span>
              ))}
            </div>
            <select className="w-full border-t border-slate-100 bg-transparent px-1 pt-1 text-[12px] text-slate-600 outline-none" value="" onChange={(e) => { if (e.target.value) setCorrespondentes((c) => [...c, e.target.value]); }}>
              <option value="">+ Adicionar obrigacao...</option>
              {disponiveis.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 flex items-center justify-end gap-1 text-[12px] font-medium text-slate-600">
            <input type="checkbox" checked={consideraVcto} onChange={(e) => setConsideraVcto(e.target.checked)} /> Considera vcto do documento? <Info />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
            <button onClick={() => navigate('/robo/assinaturas')} className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
          </div>
        </div>
      </div>

      {/* Modal de ajuda (i) */}
      {infoTexto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setInfoTexto(null)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-marca-300 text-2xl font-light text-marca-400">i</div>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-slate-600">{infoTexto}</p>
            <button onClick={() => setInfoTexto(null)} className="mt-5 rounded bg-marca-500 px-8 py-1.5 text-sm font-medium text-white hover:bg-marca-600">OK</button>
          </div>
        </div>
      )}

      {/* Log's de alteracao (toggle pelo icone de relogio) */}
      {mostrarLog && (
        <div className="mt-6">
          <h3 className="mb-2 text-[13px] font-medium text-slate-700">Log's de alteracao</h3>
          <div className="overflow-hidden rounded border border-slate-200 bg-white">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
                <th className="px-4 py-2">Data e Hora</th>
                <th className="px-4 py-2">Usuario</th>
                <th className="px-4 py-2">Acao</th>
              </tr></thead>
              <tbody>
                <tr><td colSpan={3} className="px-4 py-3 text-[13px] text-status-danger">Nenhum Log encontrado para esse Documento</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Secao nossa: reconhecimento do robo (escondida por ora - sera tratada junto do robo) */}
      {MOSTRAR_ROBO && (
      <div className="mt-6 rounded border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-slate-700">Reconhecimento do robo <span className="font-normal text-marca-400">(nosso)</span></h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LBL}>Assinaturas / palavras-chave (uma por linha — todas devem casar)</label>
            <textarea className={`${INP} font-mono`} rows={4} value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder={'DARE\nICMS'} />
          </div>
          <div className="space-y-3">
            <div>
              <label className={LBL}>Regex da competencia (opcional)</label>
              <input className={`${INP} font-mono`} value={regexCompetencia} onChange={(e) => setRegexCompetencia(e.target.value)} placeholder="periodo de apuracao\\s*:?\\s*(\\d{2}/\\d{4})" />
            </div>
            <div>
              <label className={LBL}>Exemplo de guia reconhecida (PDF)</label>
              {novo ? <p className="text-[12px] text-slate-400">Salve primeiro para anexar o PDF.</p> : (
                <div className="flex items-center gap-3">
                  <input type="file" accept="application/pdf" onChange={enviarExemplo} className="block text-[12px] file:mr-2 file:rounded file:border-0 file:bg-marca-500 file:px-3 file:py-1 file:text-white" />
                  {temExemplo && <span className="text-[12px] text-status-ok">✓ anexado</span>}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-[12px] text-slate-600"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativa</label>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
