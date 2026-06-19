import { useEffect, useState } from 'react';
import { Save, Settings, Copy, Plus, Trash2, ChevronDown, ChevronRight, Smartphone, Eye, Pencil, History, Link2, Film, MessageCircle, Globe, FileText, Phone, Mail, Calendar } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { useToast, InfoHint } from '../../components/ui';
import type { Departamento, EmpresaLista } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 block text-[12px] font-medium text-slate-600';

const OPC_PAGINA = ['Home', 'Calendario', 'Documentos', 'Solicitacoes', 'Comunicados', 'Processos', 'Dashboard'];
const OPC_CALENDARIO = ['Todas do mes', 'Demandas do dia atual', 'Todas do dia atual'];
const OPC_DOCS = ['Disponivel a partir da postagem', 'Somente apos o envio do e-mail'];
const OPC_INATIVAS = ['Acesso completo', 'Acesso bloqueado', 'Acesso somente consulta'];
const OPC_ORDENAR = ['Data da publicacao', 'Data de vencimento'];
const OPC_CONTATO = ['Desligado', 'Ligado'];

const INFO_CALENDARIO = `No mes atual e possivel definir se todos os prazos ja vem exibidos ou somente os do dia atual.

Nos demais meses, todos os prazos do mes serao exibidos por padrao.`;
const INFO_CONTATO = `Na tela de login da Area VIP e APP, os usuarios podem preencher um formulario de contato para se tornarem clientes. Apos o preenchimento, uma solicitacao sera gerada com as informacoes de contato fornecidas.`;
const INFO_DOCS = `Caso esteja desmarcada a opcao: "Recebe e-mails ref. documentos postados" e esteja selecionada a opcao "somente apos o envio do e-mail" os documentos tambem ficarao disponiveis na Area VIP.`;
const INFO_INATIVAS = `Ao selecionar acesso bloqueado somente empresas ativas serao exibidas para os usuarios do app e area vip, ja o acesso somente consulta os usuarios terao permissao para consultar os dados impossibilitando inserir novas informacoes e por ultimo o acesso completo garante aos usuarios acesso total sem nenhuma restricao mesmo que a empresa esteja inativa.

Por padrao a opcao selecionada e de acesso completo.`;

interface LinkHome { icone: string; titulo: string; url: string; empresas: string }
interface Termo { titulo: string; url: string }

const ICON_OPTS = [
  { key: 'link', label: 'Link' },
  { key: 'video', label: 'Video' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'site', label: 'Site' },
  { key: 'documento', label: 'Documento' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'calendario', label: 'Calendario' },
];
function LinkIcon({ k, size = 15 }: { k?: string; size?: number }) {
  switch (k) {
    case 'video': return <Film size={size} />;
    case 'whatsapp': return <MessageCircle size={size} />;
    case 'site': return <Globe size={size} />;
    case 'documento': return <FileText size={size} />;
    case 'telefone': return <Phone size={size} />;
    case 'email': return <Mail size={size} />;
    case 'calendario': return <Calendar size={size} />;
    default: return <Link2 size={size} />;
  }
}
const linkVazio = (): LinkHome => ({ icone: 'link', titulo: '', url: '', empresas: 'Todas' });
interface AreaVipCfg {
  linkVip?: string; appAndroid?: string; appApple?: string;
  linksHome?: LinkHome[];
  paginaInicial?: string; visualizacaoCalendario?: string; visualizacaoDocs?: string;
  acessoInativas?: string; ordenarDocs?: string; contatoNaoCliente?: string;
  deptoSolicitacaoId?: string; empresaSolicitacaoId?: string;
  termos?: Termo[];
}

export default function AreaVip() {
  const { sessao } = useAuth();
  const toast = useToast();
  const pode = temPermissao(sessao, 'admin_escritorio');

  const [cfg, setCfg] = useState<AreaVipCfg>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [nomeEscritorio, setNomeEscritorio] = useState('');
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [showLinksHome, setShowLinksHome] = useState(false);
  const [novoLink, setNovoLink] = useState<LinkHome>(linkVazio());
  const [editIdx, setEditIdx] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ nome: string; logoUrl: string | null; config: { areaVip?: AreaVipCfg } }>('/escritorio')
      .then((e) => { setNomeEscritorio(e.nome); setLogoUrl(e.logoUrl); setCfg(e.config?.areaVip ?? {}); })
      .catch(() => undefined).finally(() => setCarregando(false));
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<{ itens?: EmpresaLista[] } | EmpresaLista[]>('/empresas').then((d) => {
      setEmpresas(Array.isArray(d) ? d : d.itens ?? []);
    }).catch(() => undefined);
  }, []);

  function set(p: Partial<AreaVipCfg>) { setCfg((c) => ({ ...c, ...p })); }

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/escritorio', { config: { areaVip: cfg } });
      toast('ok', 'Configuracoes da Area VIP salvas.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  function copiar(t?: string) { if (t) navigator.clipboard?.writeText(t); toast('ok', 'Copiado.'); }

  if (carregando) return <div className="text-slate-400">Carregando...</div>;

  const links = cfg.linksHome ?? [];
  const termos = cfg.termos ?? [];

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Settings size={16} className="text-slate-400" />
          <span>Sistema</span><span className="text-slate-300">›</span>
          <span>Aplicativo e Area VIP</span><span className="text-slate-300">›</span>
          <span className="text-slate-700">Informacoes e configuracoes da Area VIP / Apps</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      {/* Links + Logo */}
      <div className="mb-4 overflow-hidden rounded border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-semibold text-slate-700">
          <Smartphone size={15} className="text-slate-400" /> Link's para Area VIP e Aplicativos / Logo
        </div>
        <div className="divide-y divide-slate-100">
          <LinhaLink label="Area VIP" valor={cfg.linkVip} onChange={(v) => set({ linkVip: v })} onCopy={() => copiar(cfg.linkVip)} placeholder="vip.exemplo.com/suaempresa" editavel={pode} />
          <LinhaLink label="App Android" valor={cfg.appAndroid} onChange={(v) => set({ appAndroid: v })} onCopy={() => copiar(cfg.appAndroid)} placeholder="https://play.google.com/store/apps/details?id=..." editavel={pode} />
          <LinhaLink label="App Apple" valor={cfg.appApple} onChange={(v) => set({ appApple: v })} onCopy={() => copiar(cfg.appApple)} placeholder="https://apps.apple.com/br/app/..." editavel={pode} />
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="w-28 font-medium text-status-danger">Logo</span>
            {logoUrl ? <img src={logoUrl} alt="Logo" className="h-16 rounded border border-slate-200 object-contain p-1" /> : <span className="text-slate-400">Defina o logo em Configuracoes gerais.</span>}
          </div>
        </div>
      </div>

      {/* Links personalizados da Home */}
      <div className="mb-1">
        <button onClick={() => setShowLinksHome((v) => !v)} className="flex items-center gap-1 text-[13px] font-medium text-marca-700 hover:underline">
          {showLinksHome ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          Link's personalizados da Home <span className="font-normal text-marca-500">(clique para {showLinksHome ? 'ocultar' : 'exibir'})</span>
        </button>
        {showLinksHome && (
          <div className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white p-3">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="text-left text-[12px] font-semibold text-slate-600">
                  <th className="px-1 pb-1 w-32">Icone</th>
                  <th className="px-1 pb-1">Titulo</th>
                  <th className="px-1 pb-1">Link</th>
                  <th className="px-1 pb-1 w-32">Empresa(s)</th>
                  <th className="px-1 pb-1 w-44 text-center">Acao</th>
                </tr>
              </thead>
              <tbody>
                {/* Linha de adicao */}
                <tr>
                  <td className="px-1 py-1">
                    <select className={INP} value={novoLink.icone} onChange={(e) => setNovoLink((l) => ({ ...l, icone: e.target.value }))}>
                      {ICON_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input className={INP} placeholder="Titulo" value={novoLink.titulo} onChange={(e) => setNovoLink((l) => ({ ...l, titulo: e.target.value }))} /></td>
                  <td className="px-1 py-1"><input className={INP} placeholder="Link" value={novoLink.url} onChange={(e) => setNovoLink((l) => ({ ...l, url: e.target.value }))} /></td>
                  <td className="px-1 py-1">
                    <select className={INP} value={novoLink.empresas} onChange={(e) => setNovoLink((l) => ({ ...l, empresas: e.target.value }))}>
                      <option value="Todas">Todas</option>
                      {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <button title="Adicionar link personalizado na Home" disabled={!novoLink.titulo.trim()}
                      onClick={() => { set({ linksHome: [...links, novoLink] }); setNovoLink(linkVazio()); }}
                      className="flex w-full items-center justify-center rounded bg-marca-500 py-1.5 text-white hover:bg-marca-600 disabled:opacity-50"><Plus size={16} /></button>
                  </td>
                </tr>
                {/* Linhas existentes */}
                {links.map((l, i) => {
                  const editando = editIdx === i;
                  const upd = (patch: Partial<LinkHome>) => set({ linksHome: links.map((x, j) => j === i ? { ...x, ...patch } : x) });
                  const empresaNome = l.empresas === 'Todas' || !l.empresas ? 'Todas' : (empresas.find((e) => e.id === l.empresas)?.razaoSocial ?? 'Todas');
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-1 py-1">
                        {editando ? (
                          <select className={INP} value={l.icone} onChange={(e) => upd({ icone: e.target.value })}>{ICON_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
                        ) : <span className="flex items-center justify-center text-marca-600"><LinkIcon k={l.icone} /></span>}
                      </td>
                      <td className="px-1 py-1">{editando ? <input className={INP} value={l.titulo} onChange={(e) => upd({ titulo: e.target.value })} /> : <span className="text-slate-600">{l.titulo}</span>}</td>
                      <td className="px-1 py-1">{editando ? <input className={INP} value={l.url} onChange={(e) => upd({ url: e.target.value })} /> : <span className="truncate text-slate-500">{l.url}</span>}</td>
                      <td className="px-1 py-1">
                        {editando ? (
                          <select className={INP} value={l.empresas} onChange={(e) => upd({ empresas: e.target.value })}><option value="Todas">Todas</option>{empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}</select>
                        ) : <span className="text-slate-500">{empresaNome}</span>}
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex justify-center gap-1">
                          <button title="Visualizar link" onClick={() => l.url && window.open(/^https?:\/\//.test(l.url) ? l.url : `https://${l.url}`, '_blank')} className="rounded bg-marca-100 p-1.5 text-marca-600 hover:bg-marca-200"><Eye size={14} /></button>
                          <button title="Editar link personalizado na Home" onClick={() => setEditIdx(editando ? null : i)} className="rounded bg-amber-100 p-1.5 text-amber-600 hover:bg-amber-200"><Pencil size={14} /></button>
                          <button title="Log's de alteracao do Link" onClick={() => toast('ok', 'Em construcao: log de alteracoes do link.')} className="rounded bg-slate-200 p-1.5 text-slate-500 hover:bg-slate-300"><History size={14} /></button>
                          <button title="Deletar link personalizado na Home" onClick={() => { if (confirm('Deletar este link?')) { set({ linksHome: links.filter((_, j) => j !== i) }); setEditIdx(null); } }} className="rounded bg-red-100 p-1.5 text-red-500 hover:bg-red-200"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Configuracoes */}
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <Campo label="Pagina inicial da Area VIP">
          <select className={INP} value={cfg.paginaInicial ?? 'Calendario'} onChange={(e) => set({ paginaInicial: e.target.value })}>{OPC_PAGINA.map((o) => <option key={o}>{o}</option>)}</select>
        </Campo>
        <Campo label="Visualizacao padrao do calendario (mes atual)" info={INFO_CALENDARIO}>
          <select className={INP} value={cfg.visualizacaoCalendario ?? OPC_CALENDARIO[0]} onChange={(e) => set({ visualizacaoCalendario: e.target.value })}>{OPC_CALENDARIO.map((o) => <option key={o}>{o}</option>)}</select>
        </Campo>
        <Campo label="Visualizacao dos documentos agendados / agrupados" info={INFO_DOCS}>
          <select className={INP} value={cfg.visualizacaoDocs ?? OPC_DOCS[1]} onChange={(e) => set({ visualizacaoDocs: e.target.value })}>{OPC_DOCS.map((o) => <option key={o}>{o}</option>)}</select>
        </Campo>
        <Campo label="Tipo de acesso em empresas inativas" info={INFO_INATIVAS}>
          <select className={INP} value={cfg.acessoInativas ?? OPC_INATIVAS[0]} onChange={(e) => set({ acessoInativas: e.target.value })}>{OPC_INATIVAS.map((o) => <option key={o}>{o}</option>)}</select>
        </Campo>
        <Campo label="Ordenar docs do calendario:">
          <select className={INP} value={cfg.ordenarDocs ?? OPC_ORDENAR[0]} onChange={(e) => set({ ordenarDocs: e.target.value })}>{OPC_ORDENAR.map((o) => <option key={o}>{o}</option>)}</select>
        </Campo>
        <Campo label="Opcao / Contato nao cliente" info={INFO_CONTATO}>
          <select className={INP} value={cfg.contatoNaoCliente ?? 'Ligado'} onChange={(e) => set({ contatoNaoCliente: e.target.value })}>{OPC_CONTATO.map((o) => <option key={o}>{o}</option>)}</select>
        </Campo>
        <Campo label="Departamento da solicitacao">
          <select className={INP} value={cfg.deptoSolicitacaoId ?? ''} onChange={(e) => set({ deptoSolicitacaoId: e.target.value })}>
            <option value="">Selecione o departamento</option>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Empresa da solicitacao">
          <select className={INP} value={cfg.empresaSolicitacaoId ?? ''} onChange={(e) => set({ empresaSolicitacaoId: e.target.value })}>
            <option value="">Selecione a empresa</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
          </select>
        </Campo>
      </div>

      {/* Politicas de privacidade / Termos de uso */}
      <div className="mt-5 rounded border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-700">Politicas de privacidade / Termos de uso</span>
          <button onClick={() => set({ termos: [...termos, { titulo: '', url: '' }] })} className="inline-flex items-center gap-1 rounded bg-marca-500 px-3 py-1 text-[12px] font-medium text-white hover:bg-marca-600"><Plus size={14} /> Adicionar</button>
        </div>
        {termos.length === 0 && <p className="text-[12px] text-status-danger">Nenhum termo de uso encontrado</p>}
        {termos.map((t, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input className={INP} placeholder="Titulo do termo" value={t.titulo} onChange={(e) => set({ termos: termos.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x) })} />
            <input className={INP} placeholder="https://... (link do documento)" value={t.url} onChange={(e) => set({ termos: termos.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
            <button onClick={() => set({ termos: termos.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      {pode && (
        <button onClick={salvar} disabled={salvando} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-status-ok py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60">
          <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar configuracoes'}
        </button>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-marca-200 pt-2 text-[12px] text-marca-600">
        <span>Usuario: {sessao?.usuario?.nome ?? '—'}</span>
        <span>Office: {nomeEscritorio || '—'}</span>
      </div>
    </div>
  );
}

function LinhaLink({ label, valor, onChange, onCopy, placeholder, editavel }: { label: string; valor?: string; onChange: (v: string) => void; onCopy: () => void; placeholder: string; editavel: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="w-28 font-medium text-status-danger">{label}</span>
      <input className={`${INP} flex-1`} value={valor ?? ''} disabled={!editavel} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button onClick={onCopy} title="Copiar" className="text-slate-400 hover:text-marca-600"><Copy size={14} /></button>
    </div>
  );
}

function Campo({ label, children, info }: { label: string; children: React.ReactNode; info?: string }) {
  return <div><label className={LBL}>{label}{info && <span className="ml-1"><InfoHint texto={info} /></span>}</label>{children}</div>;
}
