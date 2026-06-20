import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, RotateCcw, ChevronDown, ChevronRight, Building2, Eye, EyeOff } from 'lucide-react';
import { api, ApiError, getAccessToken } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Spinner, useToast, InfoHint } from '../components/ui';
import type { UsuarioCompleto, JanelaAcesso, Departamento, Tag } from '../lib/tipos';
import { TIPOS_USUARIO } from '../lib/tipos';
import { PERMISSION_AREAS, PERMISSION_PRESETS, flagsParaNiveis } from '@gestoroa/shared';

// Classes compactas (flat, fundo cinza) - estilo Acessorias
const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 block text-[12px] font-medium text-slate-600';

// Textos de ajuda (i) de areas de permissao (estilo Acessorias)
const INFO_AREAS: Record<string, string> = {
  administrativo: 'Existem algumas operacoes do Sistema, como por exemplo, avisar que uma empresa esta sem contatos em um determinado departamento ao tentar enviar guia agendada, os usuarios administrativos sao avisados por e-mail. Outro exemplo e o recebimento de e-mail dos alertas de solicitacoes que receberam notas de avaliacao abaixo de 4.',
  apla: 'Como algumas informacoes utilizadas pelo Metodo APLA sao informacoes confidenciais/sensiveis, criamos um nivel extra de permissoes para definir os acessos do Metodo APLA, pois pode acontecer de algum colaborador ter acesso para gerenciar usuarios, mas em alguns casos, nao podera liberar permissoes do Metodo APLA para outros usuarios.',
};

const INFO_CCO = `Utilize ; para enviar para varios enderecos.

ATENCAO!!! Ao utilizar essa opcao copia oculta, os destinatarios receberao uma copia EXATA da(s) mensagem(ns) enviadas aos clientes, inclusive com os mesmos links de guias que fazem o controle do protocolo digital (data/hora/IP). Portanto os destinatarios devem ser instruidos a NAO clicarem nos links dos e-mails copiados, para nao gerarem protocolos digitais falsos-positivos.`;

const INFO_CUSTO = `Estes minutos uteis serao utilizados em conjunto com o tempo previsto das demandas do colaborador, para elaboracao de relatorios, que irao cruzar estas duas informacoes e fornecer Insight's sobre a rotina produtiva do colaborador.`;

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type AcessoBloco = { permitido: boolean; inicio: string; fim: string };

// Deriva os 3 blocos (Domingo / Seg-Sex / Sabado) a partir das janelas salvas.
function janelasParaBlocos(janelas: JanelaAcesso[]): { domingo: AcessoBloco; semana: AcessoBloco; sabado: AcessoBloco } {
  const dom = janelas.find((j) => j.diaSemana === 0);
  const sem = janelas.find((j) => j.diaSemana >= 1 && j.diaSemana <= 5);
  const sab = janelas.find((j) => j.diaSemana === 6);
  return {
    domingo: { permitido: !!dom, inicio: dom?.inicio ?? '08:00', fim: dom?.fim ?? '12:00' },
    semana: { permitido: !!sem, inicio: sem?.inicio ?? '08:00', fim: sem?.fim ?? '20:00' },
    sabado: { permitido: !!sab, inicio: sab?.inicio ?? '08:00', fim: sab?.fim ?? '12:00' },
  };
}
function blocosParaJanelas(b: { domingo: AcessoBloco; semana: AcessoBloco; sabado: AcessoBloco }): JanelaAcesso[] {
  const out: JanelaAcesso[] = [];
  if (b.domingo.permitido) out.push({ diaSemana: 0, inicio: b.domingo.inicio, fim: b.domingo.fim });
  if (b.semana.permitido) for (let d = 1; d <= 5; d++) out.push({ diaSemana: d, inicio: b.semana.inicio, fim: b.semana.fim });
  if (b.sabado.permitido) out.push({ diaSemana: 6, inicio: b.sabado.inicio, fim: b.sabado.fim });
  return out;
}

export default function UsuarioForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const { sessao } = useAuth();
  const podePermissoes = temPermissao(sessao, 'admin_permissoes');

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState('Auxiliar');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [custoHora, setCustoHora] = useState('');
  const [minutosUteisMes, setMinutosUteisMes] = useState('');
  const [niveis, setNiveis] = useState<Record<string, number>>({});
  const [depIds, setDepIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [blocos, setBlocos] = useState(janelasParaBlocos([]));

  // custo detalhado + e-mail (SMTP)
  const [salario, setSalario] = useState('');
  const [encargos, setEncargos] = useState('');
  const [beneficios, setBeneficios] = useState('');
  const [verSalario, setVerSalario] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPorta, setSmtpPorta] = useState('');
  const [smtpUsuario, setSmtpUsuario] = useState('');
  const [smtpSenha, setSmtpSenha] = useState('');
  const [ccoEmails, setCcoEmails] = useState('');
  const [temAssinatura, setTemAssinatura] = useState(false);
  const [temFoto, setTemFoto] = useState(false);
  const [fotoTick, setFotoTick] = useState(0);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // secoes colapsaveis (estilo Acessorias)
  const [showPerm, setShowPerm] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showCusto, setShowCusto] = useState(false);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (novo) return;
    api.get<UsuarioCompleto>(`/usuarios/${id}`).then((u) => {
      setNome(u.nome); setEmail(u.email); setTipo(u.tipo ?? 'Auxiliar');
      setTelefone(u.telefone ?? ''); setObservacoes(u.observacoes ?? ''); setAtivo(u.ativo);
      setCustoHora(u.custoHora != null ? String(u.custoHora) : '');
      setMinutosUteisMes(u.minutosUteisMes != null ? String(u.minutosUteisMes) : '');
      setSalario(u.salario != null ? String(u.salario) : '');
      setEncargos(u.encargos != null ? String(u.encargos) : '');
      setBeneficios(u.beneficios != null ? String(u.beneficios) : '');
      setSmtpHost(u.smtpHost ?? ''); setSmtpPorta(u.smtpPorta != null ? String(u.smtpPorta) : '');
      setSmtpUsuario(u.smtpUsuario ?? ''); setCcoEmails(u.ccoEmails ?? ''); setTemAssinatura(u.temAssinatura); setTemFoto(!!u.temFoto);
      setNiveis(u.niveis ?? flagsParaNiveis(u.permissoes ?? {}));
      setDepIds(u.filtrosForcados?.departamentos ?? []);
      setTagIds(u.filtrosForcados?.tags ?? []);
      setBlocos(janelasParaBlocos(u.horariosAcesso ?? []));
    }).catch(() => toast('erro', 'Usuario nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  async function enviarAssinatura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const fd = new FormData(); fd.append('arquivo', file);
    try { await api.upload(`/usuarios/${id}/assinatura`, fd); setTemAssinatura(true); toast('ok', 'Assinatura enviada.'); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro (use imagem).'); }
  }
  async function verAssinatura() {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/usuarios/${id}/assinatura`, { headers: { Authorization: `Bearer ${getAccessToken()}` }, credentials: 'include' });
      if (!res.ok) throw new Error();
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch { toast('erro', 'Sem assinatura.'); }
  }
  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const fd = new FormData(); fd.append('arquivo', file);
    try { await api.upload(`/usuarios/${id}/foto`, fd); setTemFoto(true); setFotoTick((t) => t + 1); toast('ok', 'Foto atualizada.'); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro (use imagem).'); }
  }

  function setNivel(areaId: string, v: number) { setNiveis((n) => ({ ...n, [areaId]: v })); }
  function setBloco(chave: 'domingo' | 'semana' | 'sabado', patch: Partial<AcessoBloco>) {
    setBlocos((b) => ({ ...b, [chave]: { ...b[chave], ...patch } }));
  }

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome.');
    setSalvando(true);
    try {
      const payload = {
        nome, ativo, niveis, tipo: tipo || null,
        telefone: telefone || null, observacoes: observacoes || null,
        custoHora: custoHora === '' ? null : Number(custoHora),
        minutosUteisMes: minutosUteisMes === '' ? null : Number(minutosUteisMes),
        salario: salario === '' ? null : Number(salario),
        encargos: encargos === '' ? null : Number(encargos),
        beneficios: beneficios === '' ? null : Number(beneficios),
        smtpHost: smtpHost || null,
        smtpPorta: smtpPorta === '' ? null : Number(smtpPorta),
        smtpUsuario: smtpUsuario || null,
        smtpSenha: smtpSenha || null,
        ccoEmails: ccoEmails || null,
        horariosAcesso: blocosParaJanelas(blocos),
        filtrosForcados: { departamentos: depIds, tags: tagIds },
      };
      if (novo) {
        await api.post('/usuarios', { ...payload, email, senha: senha || '123' });
      } else {
        await api.put(`/usuarios/${id}`, payload);
        if (senha) await api.put(`/usuarios/${id}/senha`, { novaSenha: senha });
      }
      toast('ok', 'Usuario salvo.');
      navigate('/usuarios');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  const hoje = new Date().toLocaleDateString('pt-BR');
  const custoMesCalc = (Number(salario) || 0) + (Number(encargos) || 0) + (Number(beneficios) || 0);
  const minMes = Number(minutosUteisMes) || 0;
  const custoMinCalc = minMes > 0 ? custoMesCalc / minMes : 0;

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
      <div className="mb-3 text-sm text-slate-500">Sistema › Usuarios e Permissoes › <span className="text-slate-700">Cadastro de usuario e suas permissoes</span></div>

      {/* Linha principal: Nome / E-mail / Senha / Tipo */}
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-4">
        <div>
          <label className={`${LBL} flex items-center justify-between`}>Nome <span className="font-normal text-marca-500">ID: {novo ? 'Novo' : (id ?? '').slice(-6)}</span></label>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
        </div>
        <div>
          <label className={LBL}>E-Mail / Usuario de acesso</label>
          <input className={INP} value={email} disabled={!novo} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" />
        </div>
        <div>
          <label className={LBL}>Senha</label>
          <input className={INP} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={novo ? 'Senha padrao: 123' : 'Em branco = manter a mesma'} />
        </div>
        <div>
          <label className={`${LBL} flex items-center justify-between`}>Tipo <span className="font-normal text-marca-500">Cad: {hoje}</span></label>
          <select className={INP} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_USUARIO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Foto de perfil */}
      {!novo && (
        <div className="mt-3 flex items-center gap-3">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
            {temFoto ? <img src={`/api/v1/usuarios/${id}/foto?t=${fotoTick}&token=${getAccessToken() ?? ''}`} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl">{(nome[0] ?? '?').toUpperCase()}</span>}
          </div>
          <div>
            <label className={LBL}>Foto de perfil <span className="font-normal text-slate-400">(usada nos indicadores por colaborador)</span></label>
            <input type="file" accept="image/*" onChange={enviarFoto} className="block text-[12px] file:mr-2 file:rounded file:border-0 file:bg-marca-500 file:px-3 file:py-1 file:text-white" />
          </div>
        </div>
      )}

      {/* Secoes colapsaveis (links chapados) */}
      <div className="mt-3 space-y-1">
        <SecaoLink aberto={showPerm} onToggle={() => setShowPerm((v) => !v)} titulo="Permissoes desse usuario" />
        {showPerm && (
          <div className="rounded border border-slate-200 bg-white p-4">
            {!podePermissoes && <p className="mb-2 text-sm text-amber-600">Voce nao tem permissao para alterar permissoes (apenas visualizacao).</p>}
            {podePermissoes && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded bg-slate-50 px-3 py-2">
                <span className="text-[12px] font-medium text-slate-600">Aplicar preset por cargo:</span>
                {PERMISSION_PRESETS.map((p) => (
                  <button key={p.id} type="button" title={p.descricao}
                    onClick={() => { if (window.confirm(`Aplicar o preset "${p.label}"? Isso substitui as permissoes atuais.`)) setNiveis(p.niveis); }}
                    className="rounded border border-marca-300 bg-white px-2.5 py-1 text-[12px] text-marca-700 hover:bg-marca-50">
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
              {PERMISSION_AREAS.filter((a) => a.id === 'administrativo' || (niveis.administrativo ?? 0) < 1).map((a) => (
                <div key={a.id}>
                  <label className={`${LBL} ${a.id === 'administrativo' ? 'text-status-warn' : ''}`}>
                    {a.label}
                    {INFO_AREAS[a.id] && <span className="ml-1"><InfoHint texto={INFO_AREAS[a.id]} /></span>}
                    {a.extra && <span className="ml-1 font-normal text-marca-400">(nosso)</span>}
                  </label>
                  <select className={INP} disabled={!podePermissoes} value={niveis[a.id] ?? a.niveis[0].v} onChange={(e) => setNivel(a.id, Number(e.target.value))}>
                    {a.niveis.map((n) => <option key={n.v} value={n.v}>{n.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {(niveis.administrativo ?? 0) >= 1 && <p className="mt-2 text-[12px] text-marca-600">Administrativo: acesso total liberado (demais permissoes ocultadas).</p>}
          </div>
        )}

        {/* Filtros FORCADOS (inline) */}
        <div className="pt-2">
          <label className="mb-0.5 block text-[12px] font-medium text-slate-600">
            Filtros <span className="text-status-danger">FORCADOS</span> para esse usuario na lista de entregas e demais telas/relatorios:
          </label>
          <div className="rounded border border-slate-300 bg-white p-1.5">
            <div className="mb-1 flex flex-wrap gap-1">
              {depIds.length === 0 && tagIds.length === 0 && <span className="px-1 text-[11px] text-slate-400">Selecione os filtros desejados</span>}
              {depIds.map((did) => {
                const d = departamentos.find((x) => x.id === did);
                return <span key={did} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600"><button onClick={() => setDepIds((a) => a.filter((x) => x !== did))} className="text-slate-400 hover:text-red-500">×</button>Depto: {d?.nome ?? did}</span>;
              })}
              {tagIds.map((tid) => {
                const t = tags.find((x) => x.id === tid);
                return <span key={tid} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600"><button onClick={() => setTagIds((a) => a.filter((x) => x !== tid))} className="text-slate-400 hover:text-red-500">×</button>Tag: {t?.nome ?? tid}</span>;
              })}
            </div>
            <select className="w-full border-t border-slate-100 bg-transparent px-1 pt-1 text-[12px] text-slate-600 outline-none" value="" onChange={(e) => {
              const v = e.target.value; if (!v) return;
              const sep = v.indexOf(':'); const tp = v.slice(0, sep); const realId = v.slice(sep + 1);
              if (tp === 'dep') setDepIds((a) => a.includes(realId) ? a : [...a, realId]);
              else setTagIds((a) => a.includes(realId) ? a : [...a, realId]);
            }}>
              <option value="">+ Adicionar filtro...</option>
              <optgroup label="Departamentos">
                {departamentos.filter((d) => !depIds.includes(d.id)).map((d) => <option key={d.id} value={`dep:${d.id}`}>{d.nome}</option>)}
              </optgroup>
              <optgroup label="Tags">
                {tags.filter((t) => !tagIds.includes(t.id)).map((t) => <option key={t.id} value={`tag:${t.id}`}>{t.nome}</option>)}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Dados de e-mail (colapsavel) */}
        <SecaoLink aberto={showEmail} onToggle={() => setShowEmail((v) => !v)} titulo="Dados de e-mail" />
        {showEmail && (
          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-4">
              <div><label className={LBL}>Servidor de SMTP (Host)</label><input className={INP} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.exemplo.com" /></div>
              <div><label className={LBL}>Porta</label><input className={INP} value={smtpPorta} onChange={(e) => setSmtpPorta(e.target.value)} placeholder="587" /></div>
              <div><label className={LBL}>Usuario do SMTP</label><input className={INP} value={smtpUsuario} onChange={(e) => setSmtpUsuario(e.target.value)} placeholder="usuario@exemplo.com" /></div>
              <div><label className={LBL}>Senha do SMTP</label><input className={INP} type="password" value={smtpSenha} onChange={(e) => setSmtpSenha(e.target.value)} placeholder="Em branco = Mantem" /></div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
              <div>
                <label className={LBL}>Enviar Assinatura <span className="font-normal text-status-danger">Recomendado: 420px largura por 125px de altura</span></label>
                {novo ? <p className="text-[12px] text-slate-400">Salve o usuario primeiro para enviar a assinatura.</p> : (
                  <div className="flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={enviarAssinatura} className="block text-[12px] file:mr-2 file:rounded file:border-0 file:bg-marca-500 file:px-3 file:py-1 file:text-white" />
                    {temAssinatura && <button onClick={verAssinatura} className="text-[12px] text-marca-600 hover:underline">ver atual</button>}
                  </div>
                )}
              </div>
              <div>
                <label className={LBL}>Endereco para receber copia oculta (Cco) dos envios por SMTP / Gmail <InfoHint texto={INFO_CCO} /></label>
                <input className={INP} value={ccoEmails} onChange={(e) => setCcoEmails(e.target.value)} placeholder="Cco de todos e-mails enviados" />
              </div>
            </div>
          </div>
        )}

        {/* Configuracao do custo e minutos uteis (colapsavel) */}
        <SecaoLink aberto={showCusto} onToggle={() => setShowCusto((v) => !v)} titulo="Configuracao do custo e minutos uteis do colaborador" info={INFO_CUSTO} />
        {showCusto && (
          <div className="rounded border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-5">
              <div>
                <label className={`${LBL} flex items-center gap-1`}>Salario <button type="button" onClick={() => setVerSalario((v) => !v)} className="text-slate-400 hover:text-marca-600">{verSalario ? <EyeOff size={12} /> : <Eye size={12} />}</button></label>
                <input className={INP} type={verSalario ? 'text' : 'password'} value={salario} onChange={(e) => setSalario(e.target.value)} placeholder="0,00" />
              </div>
              <div><label className={LBL}>Encargos</label><input className={INP} type={verSalario ? 'text' : 'password'} value={encargos} onChange={(e) => setEncargos(e.target.value)} placeholder="0,00" /></div>
              <div><label className={LBL}>Beneficios</label><input className={INP} type={verSalario ? 'text' : 'password'} value={beneficios} onChange={(e) => setBeneficios(e.target.value)} placeholder="0,00" /></div>
              <div><label className={LBL}>Custo mes</label><input className={`${INP} bg-slate-50`} readOnly value={custoMesCalc ? fmtBRL(custoMesCalc) : ''} /></div>
              <div><label className={LBL}>Custo minuto</label><input className={`${INP} bg-slate-50`} readOnly value={custoMinCalc ? fmtBRL(custoMinCalc) : ''} /></div>
            </div>
            <div className="mt-3 md:w-1/5">
              <label className={LBL}>Minutos uteis no mes</label>
              <input className={INP} value={minutosUteisMes} onChange={(e) => setMinutosUteisMes(e.target.value)} placeholder="ex.: 8800" />
            </div>
          </div>
        )}
      </div>

      {/* Ativo + Acessos por dia + acoes (Salvar/Voltar a direita) */}
      <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-4">
        <div>
          <label className={LBL}>Usuario Ativo?</label>
          <select className={INP} value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}>
            <option value="sim">Sim</option>
            <option value="nao">Nao</option>
          </select>
        </div>
        <BlocoAcesso titulo="Acesso de Domingo?" bloco={blocos.domingo} onChange={(p) => setBloco('domingo', p)} />
        <BlocoAcesso titulo="Acesso de Seg. a Sexta?" bloco={blocos.semana} onChange={(p) => setBloco('semana', p)} />
        <BlocoAcesso titulo="Acesso de Sabado?" bloco={blocos.sabado} onChange={(p) => setBloco('sabado', p)} />
      </div>

      <div className="mt-3 grid grid-cols-1 items-end gap-x-5 gap-y-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className={LBL}>Dados complementares</label>
          <input className={INP} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Comentarios" />
        </div>
        <div>
          <label className={LBL}>Fone(s)</label>
          <input className={INP} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Fone" />
        </div>
        <div>
          <div className="mb-0.5 text-right text-[11px] text-marca-500">UA: {novo ? 'Ainda sem acesso' : '—'}</div>
          <div className="flex justify-end gap-2">
            <button className="flex items-center gap-2 rounded-md bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50" onClick={salvar} disabled={salvando}><Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
            <button className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500" onClick={() => navigate('/usuarios')}><RotateCcw size={16} /> Voltar</button>
          </div>
        </div>
      </div>

      {!novo && (
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-slate-200 py-2.5 text-[13px] text-slate-600 hover:bg-slate-300" onClick={() => navigate('/empresas')}>
          <Building2 size={15} /> Visualizar as empresas que este colaborador tem departamentos sob responsabilidade
        </button>
      )}
    </div>
  );
}

function SecaoLink({ aberto, onToggle, titulo, info }: { aberto: boolean; onToggle: () => void; titulo: string; info?: string }) {
  return (
    <div className="flex items-center gap-1 text-[13px] font-medium text-marca-700">
      <button onClick={onToggle} className="flex items-center gap-1 text-left hover:underline">
        {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {titulo}
      </button>
      {info && <InfoHint texto={info} />}
      <button onClick={onToggle} className="font-normal text-marca-500 hover:underline">(clique para {aberto ? 'ocultar' : 'exibir'})</button>
    </div>
  );
}

function BlocoAcesso({ titulo, bloco, onChange }: { titulo: string; bloco: AcessoBloco; onChange: (p: Partial<AcessoBloco>) => void }) {
  return (
    <div>
      <label className={LBL}>{titulo}</label>
      <div className="flex gap-1">
        <select className={INP} value={bloco.permitido ? 'p' : 'b'} onChange={(e) => onChange({ permitido: e.target.value === 'p' })}>
          <option value="b">Bloqueado</option>
          <option value="p">Permitido</option>
        </select>
        <input type="time" className={`${INP} w-20`} value={bloco.inicio} disabled={!bloco.permitido} onChange={(e) => onChange({ inicio: e.target.value })} />
        <input type="time" className={`${INP} w-20`} value={bloco.fim} disabled={!bloco.permitido} onChange={(e) => onChange({ fim: e.target.value })} />
      </div>
    </div>
  );
}
