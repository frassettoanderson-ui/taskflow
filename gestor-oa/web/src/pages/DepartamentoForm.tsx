import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, RotateCcw, Mail, Copy, Network, Plus } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Spinner, useToast, InfoHint } from '../components/ui';
import type { Departamento } from '../lib/tipos';

interface FormularioItem { id: string; nome: string; ativo: boolean }
interface LogEntry { id: string; acao: string; antes: unknown; depois: unknown; createdAt: string; usuario?: { nome: string } | null }

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 flex items-center gap-1 text-[12px] font-medium text-slate-600';

const INFO_GESTORES = 'Finalidade: alem do carater informativo, essa opcao e utilizada no envio de e-mail de documentos do robo, como balancos e DRE do contabil por exemplo, que alguns escritorios gostam que os documentos sejam enviados para o e-mail dos gestores apos a finalizacao do processo.';
const INFO_SOLICITACOES = 'O Departamento deve aparecer como opcao para abertura de novas Solicitacoes na Area VIP / APP?';
const INFO_RESPONDER = 'Esse endereco de e-mail sera utilizado como destino de respostas de e-mails enviados atraves das guias desse departamento, caso esteja configurado para tal nas Configuracoes do Sistema.';

const ENVIO_OPCOES = [
  'De hora em hora',
  'No proximo dia',
  'Toda segunda-feira',
  'Toda terca-feira',
  'Toda quarta-feira',
  'Toda quinta-feira',
  'Toda sexta-feira',
  'Todo sabado',
  'Todo domingo',
  ...Array.from({ length: 20 }, (_, i) => `${i + 1}o dia util`),
  'Somente envio manual',
];

export default function DepartamentoForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#0f5c5e');
  const [parentId, setParentId] = useState<string>(params.get('pai') ?? '');
  const [gestoresIds, setGestoresIds] = useState<string[]>([]);
  const [envioAgendado, setEnvioAgendado] = useState('De hora em hora');
  const [disponivelSolic, setDisponivelSolic] = useState(true);
  const [responderPara, setResponderPara] = useState('');
  const [obrigacoesCount, setObrigacoesCount] = useState(0);

  const [deps, setDeps] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  // combo de gestores (chips + busca)
  const [gestorTxt, setGestorTxt] = useState('');
  const [gestorAberto, setGestorAberto] = useState(false);

  // secoes expansiveis do rodape
  const [showGrupos, setShowGrupos] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [formularios, setFormularios] = useState<FormularioItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  function carregarFormularios() {
    api.get<FormularioItem[]>('/gestao-portal/formularios').then(setFormularios).catch(() => setFormularios([]));
  }
  function carregarLog() {
    if (novo) return;
    api.get<LogEntry[]>(`/departamentos/${id}/log`).then(setLogs).catch(() => setLogs([]));
  }

  const CAMPO_LABEL: Record<string, string> = {
    nome: 'Nome', envioAgendado: 'Envio agendado', responderPara: "Endereco de 'Responder para'",
    disponivelSolicitacoes: 'Disponivel em Solicitacoes', parentId: 'Departamento pai', gestoresIds: 'Usuarios gestores do departamento', cor: 'Cor',
  };
  function nomeGestores(v: unknown) { const arr = Array.isArray(v) ? (v as string[]) : []; return arr.map((g) => usuarios.find((u) => u.id === g)?.nome ?? g).join(', '); }
  function valLog(campo: string, v: unknown) {
    if (campo === 'gestoresIds') return nomeGestores(v);
    if (campo === 'parentId') return v ? (deps.find((d) => d.id === v)?.nome ?? String(v)) : '';
    if (campo === 'disponivelSolicitacoes') return v ? 'Sim' : 'Nao';
    return v == null ? '' : String(v);
  }
  function descreverLog(l: LogEntry): string {
    if (l.acao === 'CREATE') return 'Departamento criado';
    const antes = (l.antes ?? {}) as Record<string, unknown>;
    const depois = (l.depois ?? {}) as Record<string, unknown>;
    const mud = Object.keys(CAMPO_LABEL).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]));
    if (!mud.length) return 'Departamento atualizado';
    return mud.map((k) => `${CAMPO_LABEL[k]} "${valLog(k, antes[k])}" para "${valLog(k, depois[k])}"`).join('; ');
  }

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDeps).catch(() => undefined);
    api.get<{ id: string; nome: string }[]>('/usuarios').then(setUsuarios).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (novo) return;
    api.get<Departamento>(`/departamentos/${id}`).then((d) => {
      setNome(d.nome); setCor(d.cor); setParentId(d.parentId ?? '');
      setGestoresIds(d.gestoresIds ?? (d.responsavelId ? [d.responsavelId] : [])); setEnvioAgendado(d.envioAgendado);
      setDisponivelSolic(d.disponivelSolicitacoes); setResponderPara(d.responderPara ?? '');
      setObrigacoesCount(d.obrigacoesCount ?? 0);
    }).catch(() => toast('erro', 'Departamento nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome do departamento.');
    setSalvando(true);
    try {
      const payload = {
        nome, cor,
        parentId: parentId || null,
        gestoresIds,
        envioAgendado,
        disponivelSolicitacoes: disponivelSolic,
        responderPara: responderPara || null,
      };
      if (novo) await api.post('/departamentos', payload);
      else await api.put(`/departamentos/${id}`, payload);
      toast('ok', 'Departamento salvo.');
      navigate('/cadastros');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  const candidatosPai = deps.filter((d) => d.id !== id);

  return (
    <div className="-m-6 min-h-full bg-fundo p-5 text-[13px]">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Network size={16} className="text-slate-400" />
        <span>Sistema</span>
        <span className="text-slate-300">›</span>
        <span className="text-slate-700">Gestao de departamentos da empresa</span>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-3">
        {/* Coluna 1 */}
        <div>
          <label className={LBL}>Departamento pai</label>
          <select className={INP} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Nenhum</option>
            {candidatosPai.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>

        {/* Coluna 2 */}
        <div>
          <label className={LBL}>
            Nome do departamento
            <button type="button" title="Replicar marcacoes/responsaveis nas empresas" onClick={() => toast('ok', 'Em construcao: Replicar marcacoes/responsaveis nas empresas.')} className="ml-auto text-slate-400 hover:text-marca-500"><Copy size={14} /></button>
          </label>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do departamento" />
        </div>

        {/* Coluna 3 */}
        <div>
          <label className={LBL}>Envio dos e-mails agrupados / agendados</label>
          <select className={INP} value={envioAgendado} onChange={(e) => setEnvioAgendado(e.target.value)}>
            {ENVIO_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <label className={LBL}>Usuarios gestores do departamento <InfoHint texto={INFO_GESTORES} /></label>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-1">
              {gestoresIds.map((gid) => {
                const u = usuarios.find((x) => x.id === gid);
                return (
                  <span key={gid} className="inline-flex items-center gap-1 rounded bg-marca-50 px-1.5 py-0.5 text-[11px] text-marca-700">
                    <button type="button" onClick={() => setGestoresIds((g) => g.filter((x) => x !== gid))} className="text-slate-400 hover:text-red-500">×</button>
                    {u?.nome ?? gid}
                  </span>
                );
              })}
              <input
                className="min-w-[110px] flex-1 text-[12px] outline-none"
                placeholder={gestoresIds.length ? '' : 'Nenhum gestor selecionado'}
                value={gestorTxt}
                onChange={(e) => { setGestorTxt(e.target.value); setGestorAberto(true); }}
                onFocus={() => setGestorAberto(true)}
                onBlur={() => setTimeout(() => setGestorAberto(false), 150)}
              />
            </div>
            {gestorAberto && (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
                {usuarios.filter((u) => !gestoresIds.includes(u.id) && u.nome.toLowerCase().includes(gestorTxt.trim().toLowerCase())).map((u) => (
                  <button key={u.id} type="button" onMouseDown={() => { setGestoresIds((g) => [...g, u.id]); setGestorTxt(''); }} className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-marca-50">{u.nome}</button>
                ))}
                {usuarios.filter((u) => !gestoresIds.includes(u.id)).length === 0 && <div className="px-3 py-1.5 text-[12px] text-slate-400">Sem mais usuarios</div>}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className={LBL}>Disponivel em novas Solicitacoes? <InfoHint texto={INFO_SOLICITACOES} /></label>
          <select className={INP} value={disponivelSolic ? 'sim' : 'nao'} onChange={(e) => setDisponivelSolic(e.target.value === 'sim')}>
            <option value="sim">Sim</option>
            <option value="nao">Nao</option>
          </select>
        </div>

        <div>
          <label className={LBL}>Endereco de 'Responder para' <InfoHint texto={INFO_RESPONDER} /></label>
          <input className={INP} value={responderPara} onChange={(e) => setResponderPara(e.target.value)} placeholder="responder@suaempresa.com" />
        </div>

        {/* Botoes secundarios + acoes */}
        <button onClick={() => toast('ok', 'Em construcao: edicao do e-mail individual.')} className="flex items-center justify-center gap-2 rounded bg-slate-400 py-1.5 text-[12px] font-medium text-white hover:bg-slate-500">
          <Mail size={14} /> Editar e-mail Individual
        </button>
        <button onClick={() => toast('ok', 'Em construcao: edicao do e-mail de agendamento.')} className="flex items-center justify-center gap-2 rounded bg-slate-400 py-1.5 text-[12px] font-medium text-white hover:bg-slate-500">
          <Mail size={14} /> Editar e-mail de Agendamento
        </button>
        <div className="flex justify-end gap-2">
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
          <button onClick={() => navigate('/cadastros')} className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      {/* Rodape: informacoes/links */}
      <div className="mt-5 space-y-4 text-[12px] text-slate-700">
        <p>
          Temos <b>{obrigacoesCount}</b> obrigacoes pertencentes a esse departamento.{' '}
          <button onClick={() => navigate(`/obrigacoes?dep=${id ?? ''}`)} className="text-marca-600 hover:underline">«Clique aqui para visualiza-las»</button>
        </p>

        {/* Grupos de campos personalizados (formularios) */}
        <div>
          <p className="font-medium">
            Grupos de campos personalizados, para coleta de informacoes, atraves de solicitacoes na Area VIP{' '}
            <button onClick={() => { setShowGrupos((v) => !v); if (!showGrupos) carregarFormularios(); }} className={showGrupos ? 'text-status-danger hover:underline' : 'text-marca-600 hover:underline'}>
              ({showGrupos ? 'Clique para ocultar' : 'Clique para listar'})
            </button>
          </p>
          {showGrupos && (
            <div className="mt-1 overflow-hidden rounded border border-slate-200">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-fundo text-left font-semibold text-slate-600">
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => navigate('/area-vip/formularios')} className="inline-flex items-center gap-1 rounded bg-marca-500 px-3 py-1 font-medium text-white hover:bg-marca-600"><Plus size={13} /> Add</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {formularios.map((f) => (
                    <tr key={f.id} className="border-b border-slate-100 odd:bg-white even:bg-fundo">
                      <td className="px-3 py-2"><button onClick={() => navigate('/area-vip/formularios')} className="text-marca-600 hover:underline">{f.nome}</button></td>
                      <td className="px-3 py-2 text-slate-600">{f.ativo ? 'Ativo' : 'Inativo'}</td>
                      <td className="px-3 py-2" />
                    </tr>
                  ))}
                  {formularios.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">Nenhum grupo de campos cadastrado.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Log das alteracoes */}
        <div>
          <p className="font-medium">
            Log das alteracoes - ultimas 15 em ordem decrescente{' '}
            <button onClick={() => { setShowLog((v) => !v); if (!showLog) carregarLog(); }} className={showLog ? 'text-status-danger hover:underline' : 'text-marca-600 hover:underline'}>
              ({showLog ? 'Clique para ocultar' : 'Clique para listar'})
            </button>
          </p>
          {showLog && (
            <div className="mt-1 overflow-hidden rounded border border-slate-200">
              {logs.length === 0 && <p className="px-3 py-3 text-slate-400">Nenhuma alteracao registrada.</p>}
              {logs.map((l, i) => (
                <div key={l.id} className={`px-3 py-1.5 ${i % 2 ? 'bg-fundo' : 'bg-white'}`}>
                  <div className="text-[11px] font-semibold text-status-danger">{l.usuario?.nome ?? 'Sistema'} em {new Date(l.createdAt).toLocaleString('pt-BR')}:</div>
                  <div className="pl-3 text-slate-600">{descreverLog(l)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

