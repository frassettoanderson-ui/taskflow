import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, RotateCcw, Mail, Copy, Network } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Spinner, useToast, InfoHint } from '../components/ui';
import type { Departamento } from '../lib/tipos';

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
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
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
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} title="Cor" className="ml-auto h-4 w-5 cursor-pointer rounded border border-slate-300 p-0" />
            <button type="button" title="Copiar nome" onClick={() => navigator.clipboard?.writeText(nome)} className="text-slate-400 hover:text-marca-500"><Copy size={13} /></button>
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
          <div className="rounded border border-slate-300 bg-white p-1.5">
            <div className="mb-1 flex flex-wrap gap-1">
              {gestoresIds.length === 0 && <span className="px-1 text-[11px] text-slate-400">Nenhum gestor selecionado</span>}
              {gestoresIds.map((gid) => {
                const u = usuarios.find((x) => x.id === gid);
                return (
                  <span key={gid} className="inline-flex items-center gap-1 rounded bg-marca-50 px-1.5 py-0.5 text-[11px] text-marca-700">
                    {u?.nome ?? gid}
                    <button type="button" onClick={() => setGestoresIds((g) => g.filter((x) => x !== gid))} className="text-slate-400 hover:text-red-500">×</button>
                  </span>
                );
              })}
            </div>
            <select
              className="w-full border-t border-slate-100 bg-transparent px-1 pt-1 text-[12px] text-slate-600 outline-none"
              value=""
              onChange={(e) => { if (e.target.value) setGestoresIds((g) => [...g, e.target.value]); }}
            >
              <option value="">+ Adicionar gestor...</option>
              {usuarios.filter((u) => !gestoresIds.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
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
        <button onClick={() => toast('ok', 'Em construcao: edicao do e-mail individual.')} className="flex items-center justify-center gap-2 rounded bg-slate-200 py-1.5 text-[12px] text-slate-600 hover:bg-slate-300">
          <Mail size={14} /> Editar e-mail Individual
        </button>
        <button onClick={() => toast('ok', 'Em construcao: edicao do e-mail de agendamento.')} className="flex items-center justify-center gap-2 rounded bg-slate-200 py-1.5 text-[12px] text-slate-600 hover:bg-slate-300">
          <Mail size={14} /> Editar e-mail de Agendamento
        </button>
        <div className="flex justify-end gap-2">
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
          <button onClick={() => navigate('/cadastros')} className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      {/* Rodape: informacoes/links */}
      <div className="mt-5 space-y-2 text-[12px] text-slate-600">
        <p>
          Temos <b>{obrigacoesCount}</b> obrigacoes pertencentes a esse departamento.{' '}
          <button onClick={() => navigate('/obrigacoes')} className="text-marca-600 hover:underline">«Clique aqui para visualiza-las»</button>
        </p>
        <p>
          Grupos de campos personalizados, para coleta de informacoes, atraves de solicitacoes na Area VIP{' '}
          <button onClick={() => toast('ok', 'Em construcao.')} className="text-marca-600 hover:underline">(Clique para listar)</button>
        </p>
        <p>
          Log das alteracoes - ultimas 15 em ordem decrescente{' '}
          <button onClick={() => toast('ok', 'Em construcao.')} className="text-marca-600 hover:underline">(Clique para listar)</button>
        </p>
      </div>
    </div>
  );
}

