import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { portalApi, PortalError, setPortalToken, getPortalToken, setEmpresaAtual, getEmpresaAtual } from './portalApi';

interface Branding { nome: string; cor: string; logoUrl: string | null }
interface Me { nome: string; email: string; empresas: { id: string; razaoSocial: string }[]; empresaAtual: string }

export default function PortalApp() {
  const [branding, setBranding] = useState<Branding | null>(null);
  useEffect(() => { portalApi.get<Branding>('/config').then(setBranding).catch(() => setBranding({ nome: 'Area VIP', cor: '#0f5c5e', logoUrl: null })); }, []);
  useEffect(() => { if (branding) document.documentElement.style.setProperty('--portal-cor', branding.cor); }, [branding]);

  return (
    <Routes>
      <Route path="login" element={<Login branding={branding} />} />
      <Route path="definir-senha" element={<DefinirSenha branding={branding} />} />
      <Route path="*" element={<PortalPrivado branding={branding} />} />
    </Routes>
  );
}

function cor(b: Branding | null) { return b?.cor ?? '#0f5c5e'; }

function Login({ branding }: { branding: Branding | null }) {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true);
    try {
      const r = await portalApi.post<{ token: string }>('/login', { email, senha });
      setPortalToken(r.token);
      nav('/portal');
    } catch (err) { setErro(err instanceof PortalError ? err.message : 'Erro'); } finally { setLoading(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4" style={{ background: cor(branding) }}>
      <div className="w-full max-w-sm rounded-lg bg-white p-7 shadow-xl">
        <div className="mb-5 text-center">
          {branding?.logoUrl ? <img src={branding.logoUrl} alt="" className="mx-auto h-12 object-contain" /> : <div className="text-2xl font-bold" style={{ color: cor(branding) }}>{branding?.nome ?? 'Area VIP'}</div>}
          <p className="mt-1 text-sm text-slate-500">Portal do cliente</p>
        </div>
        <form onSubmit={entrar} className="space-y-3">
          <div><label className="label">E-mail</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label">Senha</label><input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
          {erro && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <button className="btn w-full text-white" style={{ background: cor(branding) }} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}

function DefinirSenha({ branding }: { branding: Branding | null }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [senha, setSenha] = useState('');
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro('');
    try { await portalApi.post('/definir-senha', { token, senha }); setOk(true); }
    catch (err) { setErro(err instanceof PortalError ? err.message : 'Erro'); }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4" style={{ background: cor(branding) }}>
      <div className="w-full max-w-sm rounded-lg bg-white p-7 shadow-xl">
        <h1 className="mb-4 text-lg font-semibold text-slate-800">Definir senha</h1>
        {ok ? (
          <div className="space-y-3">
            <div className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Senha definida! Voce ja pode entrar.</div>
            <a href="/portal/login" className="btn w-full text-white" style={{ background: cor(branding) }}>Ir para o login</a>
          </div>
        ) : !token ? (
          <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">Link invalido.</div>
        ) : (
          <form onSubmit={salvar} className="space-y-3">
            <div><label className="label">Nova senha (min 8)</label><input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={8} required /></div>
            {erro && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
            <button className="btn w-full text-white" style={{ background: cor(branding) }}>Salvar</button>
          </form>
        )}
      </div>
    </div>
  );
}

function PortalPrivado({ branding }: { branding: Branding | null }) {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [lgpdOk, setLgpdOk] = useState(true);

  useEffect(() => {
    if (!getPortalToken()) { nav('/portal/login'); return; }
    portalApi.get<Me>('/me').then((m) => {
      setMe(m);
      if (!getEmpresaAtual()) setEmpresaAtual(m.empresaAtual);
    }).catch(() => { setPortalToken(null); nav('/portal/login'); }).finally(() => setCarregando(false));
  }, [nav]);

  useEffect(() => {
    portalApi.get<{ aceito: boolean }>('/lgpd').then((r) => setLgpdOk(r.aceito)).catch(() => undefined);
  }, []);

  if (carregando) return <div className="grid min-h-screen place-items-center text-slate-400">Carregando...</div>;
  if (!me) return <Navigate to="/portal/login" replace />;

  const c = cor(branding);
  const nav_itens = [
    { to: '/portal', label: 'Inicio', end: true },
    { to: '/portal/documentos', label: 'Documentos' },
    { to: '/portal/enviar-documentos', label: 'Enviar documentos' },
    { to: '/portal/calendario', label: 'Calendario' },
    { to: '/portal/comunicados', label: 'Comunicados' },
    { to: '/portal/solicitacoes', label: 'Solicitacoes' },
    { to: '/portal/processos', label: 'Processos' },
    { to: '/portal/colaborador', label: 'Cadastrar colaborador' },
    { to: '/portal/meus-dados', label: 'Meus dados' },
    { to: '/portal/avalie-nos', label: 'Avalie-nos' },
    { to: '/portal/lgpd', label: 'Privacidade' },
  ];

  function sair() { setPortalToken(null); setEmpresaAtual(null); nav('/portal/login'); }
  function trocarEmpresa(id: string) { setEmpresaAtual(id); window.location.reload(); }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex flex-wrap items-center gap-3 px-6 py-3 text-white" style={{ background: c }}>
        <span className="font-bold">{branding?.nome ?? 'Area VIP'}</span>
        <nav className="flex flex-wrap gap-1 text-sm">
          {nav_itens.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `rounded px-3 py-1 ${isActive ? 'bg-white/25' : 'hover:bg-white/10'}`}>{i.label}</NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {me.empresas.length > 1 && (
            <select className="rounded bg-white/20 px-2 py-1 text-white" value={getEmpresaAtual() ?? ''} onChange={(e) => trocarEmpresa(e.target.value)}>
              {me.empresas.map((emp) => <option key={emp.id} value={emp.id} className="text-slate-800">{emp.razaoSocial}</option>)}
            </select>
          )}
          <span>{me.nome}</span>
          <button onClick={sair} className="rounded bg-white/20 px-2 py-1">Sair</button>
        </div>
      </header>

      {!lgpdOk && (
        <div className="bg-amber-100 px-6 py-2 text-sm text-amber-800">
          Voce precisa aceitar a Politica de Privacidade. <NavLink to="/portal/lgpd" className="font-medium underline">Revisar agora</NavLink>
        </div>
      )}

      <main className="mx-auto max-w-5xl p-6">
        <Routes>
          <Route index element={<Home />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="enviar-documentos" element={<EnviarDocumentos />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="comunicados" element={<Comunicados />} />
          <Route path="solicitacoes" element={<Solicitacoes />} />
          <Route path="processos" element={<Processos />} />
          <Route path="colaborador" element={<Colaborador />} />
          <Route path="meus-dados" element={<MeusDados />} />
          <Route path="avalie-nos" element={<AvalieNos />} />
          <Route path="lgpd" element={<Lgpd onAceito={() => setLgpdOk(true)} />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ---------- Paginas ----------
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">{children}</div>; }

function Home() {
  const [d, setD] = useState<{ docsNovos: number; solicitacoesAbertas: number; comunicados: number } | null>(null);
  useEffect(() => { portalApi.get<typeof d>('/home').then(setD); }, []);
  if (!d) return <p className="text-slate-400">Carregando...</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Bem-vindo</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><div className="text-3xl font-bold text-slate-700">{d.docsNovos}</div><div className="text-sm text-slate-500">Documentos novos (mes)</div></Card>
        <Card><div className="text-3xl font-bold text-slate-700">{d.solicitacoesAbertas}</div><div className="text-sm text-slate-500">Solicitacoes abertas</div></Card>
        <Card><div className="text-3xl font-bold text-slate-700">{d.comunicados}</div><div className="text-sm text-slate-500">Comunicados</div></Card>
      </div>
    </div>
  );
}

interface Doc { id: string; raiz: string; pasta: string; nomeArquivo: string; tamanho: number; createdAt: string }
function Documentos() {
  const [raiz, setRaiz] = useState<'DocsEntregas' | 'DocsEmpresa'>('DocsEntregas');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busca, setBusca] = useState('');
  useEffect(() => {
    const qs = new URLSearchParams({ raiz }); if (busca) qs.set('busca', busca);
    const t = setTimeout(() => portalApi.get<Doc[]>(`/documentos?${qs}`).then(setDocs), 200);
    return () => clearTimeout(t);
  }, [raiz, busca]);

  async function baixar(d: Doc) {
    const res = await fetch(portalApi.downloadUrl(`/documentos/${d.id}/download`), { headers: portalApi.authHeaders() });
    const blob = await res.blob(); const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = d.nomeArquivo; a.click(); URL.revokeObjectURL(u);
  }
  async function baixarZip() {
    const res = await fetch(portalApi.downloadUrl(`/documentos/zip?raiz=${raiz}`), { headers: portalApi.authHeaders() });
    const blob = await res.blob(); const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = 'documentos.zip'; a.click(); URL.revokeObjectURL(u);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-800">Documentos</h1>
        <div className="flex gap-2">
          <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1 text-sm">
            {(['DocsEntregas', 'DocsEmpresa'] as const).map((r) => <button key={r} onClick={() => setRaiz(r)} className={`rounded px-3 py-1 ${raiz === r ? 'bg-slate-700 text-white' : 'text-slate-600'}`}>{r === 'DocsEntregas' ? 'Guias / Entregas' : 'Documentos'}</button>)}
          </div>
          <input className="input w-44" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button className="btn-ghost border border-slate-300" onClick={baixarZip}>Baixar tudo</button>
        </div>
      </div>
      <Card>
        <div className="divide-y divide-slate-100">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between py-2 text-sm">
              <button className="text-left text-slate-700 hover:underline" onClick={() => baixar(d)}>{d.pasta ? `${d.pasta}/` : ''}{d.nomeArquivo}</button>
              <span className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
          {docs.length === 0 && <p className="py-6 text-center text-slate-400">Nenhum documento.</p>}
        </div>
      </Card>
    </div>
  );
}

function Calendario() {
  const hoje = new Date();
  const [itens, setItens] = useState<{ id: string; obrigacao: string; prazoLegal: string; status: string }[]>([]);
  useEffect(() => { portalApi.get<typeof itens>(`/calendario?ano=${hoje.getFullYear()}&mes=${hoje.getMonth() + 1}`).then(setItens); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Calendario do mes</h1>
      <Card>
        <div className="divide-y divide-slate-100">
          {itens.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">{e.obrigacao}</span>
              <span className="text-slate-500">vence {new Date(e.prazoLegal).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
            </div>
          ))}
          {itens.length === 0 && <p className="py-6 text-center text-slate-400">Sem vencimentos.</p>}
        </div>
      </Card>
    </div>
  );
}

function Comunicados() {
  const [itens, setItens] = useState<{ id: string; titulo: string; conteudo: string; createdAt: string; lido: boolean }[]>([]);
  function carregar() { portalApi.get<typeof itens>('/comunicados').then(setItens); }
  useEffect(carregar, []);
  async function ler(id: string) { await portalApi.post(`/comunicados/${id}/ler`); carregar(); }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Comunicados</h1>
      {itens.map((c) => (
        <Card key={c.id}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">{c.titulo} {!c.lido && <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">novo</span>}</h2>
            <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{c.conteudo}</p>
          {!c.lido && <button className="mt-2 text-sm text-marca-600 hover:underline" onClick={() => ler(c.id)}>Marcar como lido</button>}
        </Card>
      ))}
      {itens.length === 0 && <p className="text-slate-400">Nenhum comunicado.</p>}
    </div>
  );
}

interface Sol { id: string; titulo: string; status: string; createdAt: string }
function Solicitacoes() {
  const [itens, setItens] = useState<Sol[]>([]);
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  function carregar() { portalApi.get<Sol[]>('/solicitacoes').then(setItens); }
  useEffect(carregar, []);
  if (aberta) return <SolicitacaoThread id={aberta} onVoltar={() => { setAberta(null); carregar(); }} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Solicitacoes</h1>
        <button className="btn-primary" onClick={() => setNova(true)}>+ Nova solicitacao</button>
      </div>
      <Card>
        <div className="divide-y divide-slate-100">
          {itens.map((s) => (
            <button key={s.id} onClick={() => setAberta(s.id)} className="flex w-full items-center justify-between py-2 text-left text-sm hover:bg-slate-50">
              <span className="text-slate-700">{s.titulo}</span>
              <span className="text-xs text-slate-400">{s.status}</span>
            </button>
          ))}
          {itens.length === 0 && <p className="py-6 text-center text-slate-400">Nenhuma solicitacao.</p>}
        </div>
      </Card>
      {nova && <NovaSolicitacao onFechar={() => setNova(false)} onCriada={() => { setNova(false); carregar(); }} />}
    </div>
  );
}

interface CampoForm { id: string; label: string; tipo: string; opcoes?: string[]; obrigatorio?: boolean }
interface FormDef { id: string; nome: string; descricao: string | null; campos: CampoForm[] }

function NovaSolicitacao({ onFechar, onCriada }: { onFechar: () => void; onCriada: () => void }) {
  const [titulo, setTitulo] = useState(''); const [descricao, setDescricao] = useState('');
  const [forms, setForms] = useState<FormDef[]>([]);
  const [formId, setFormId] = useState('');
  const [resp, setResp] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');
  useEffect(() => { portalApi.get<FormDef[]>('/formularios').then(setForms).catch(() => undefined); }, []);

  const form = forms.find((f) => f.id === formId);

  async function salvar() {
    setErro('');
    if (!titulo || !descricao) { setErro('Preencha titulo e descricao.'); return; }
    let respostas: { campoId: string; label: string; valor: string }[] | undefined;
    if (form) {
      for (const c of form.campos) if (c.obrigatorio && !resp[c.id]?.trim()) { setErro(`Preencha: ${c.label}`); return; }
      respostas = form.campos.filter((c) => resp[c.id]?.trim()).map((c) => ({ campoId: c.id, label: c.label, valor: resp[c.id] }));
    }
    await portalApi.post('/solicitacoes', { titulo, descricao, formularioId: formId || undefined, respostas });
    onCriada();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-semibold">Nova solicitacao</h2>
        <div className="space-y-3">
          {forms.length > 0 && (
            <div>
              <label className="label">Tipo de solicitacao</label>
              <select className="input" value={formId} onChange={(e) => { setFormId(e.target.value); setResp({}); }}>
                <option value="">Solicitacao livre</option>
                {forms.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              {form?.descricao && <p className="mt-1 text-xs text-slate-400">{form.descricao}</p>}
            </div>
          )}
          <input className="input" placeholder="Titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <textarea className="input" rows={3} placeholder="Descreva o que precisa" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          {form?.campos.map((c) => (
            <div key={c.id}>
              <label className="label">{c.label}{c.obrigatorio ? ' *' : ''}</label>
              {c.tipo === 'textarea' ? (
                <textarea className="input" rows={2} value={resp[c.id] ?? ''} onChange={(e) => setResp((r) => ({ ...r, [c.id]: e.target.value }))} />
              ) : c.tipo === 'select' ? (
                <select className="input" value={resp[c.id] ?? ''} onChange={(e) => setResp((r) => ({ ...r, [c.id]: e.target.value }))}>
                  <option value="">Selecione</option>{(c.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input className="input" type={c.tipo === 'numero' ? 'number' : c.tipo === 'data' ? 'date' : 'text'} value={resp[c.id] ?? ''} onChange={(e) => setResp((r) => ({ ...r, [c.id]: e.target.value }))} />
              )}
            </div>
          ))}
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Enviar</button></div>
        </div>
      </div>
    </div>
  );
}

function SolicitacaoThread({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [s, setS] = useState<{ titulo: string; status: string; mensagens: { id: string; autorNome: string; texto: string; createdAt: string; autorTipo: string }[] } | null>(null);
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState(0);
  function carregar() { portalApi.get<typeof s>(`/solicitacoes/${id}`).then(setS); }
  useEffect(carregar, [id]);
  if (!s) return <p className="text-slate-400">Carregando...</p>;
  async function enviar() { if (!texto.trim()) return; await portalApi.post(`/solicitacoes/${id}/mensagem`, { texto }); setTexto(''); carregar(); }
  async function avaliar() { if (!nota) return; await portalApi.post(`/solicitacoes/${id}/avaliar`, { nota }); onVoltar(); }
  return (
    <div className="space-y-4">
      <button onClick={onVoltar} className="text-sm text-marca-600 hover:underline">← Voltar</button>
      <h1 className="text-xl font-semibold text-slate-800">{s.titulo} <span className="text-sm text-slate-400">· {s.status}</span></h1>
      <Card>
        <div className="space-y-2">
          {s.mensagens.map((m) => (
            <div key={m.id} className={`rounded p-2 text-sm ${m.autorTipo === 'CONTATO' ? 'bg-marca-50' : 'bg-slate-100'}`}>
              <div className="text-xs text-slate-400">{m.autorNome} · {new Date(m.createdAt).toLocaleString('pt-BR')}</div>
              <div className="text-slate-700">{m.texto}</div>
            </div>
          ))}
        </div>
        {s.status !== 'FINALIZADA' && (
          <div className="mt-3 flex gap-2">
            <input className="input flex-1" placeholder="Responder..." value={texto} onChange={(e) => setTexto(e.target.value)} />
            <button className="btn-primary" onClick={enviar}>Enviar</button>
          </div>
        )}
      </Card>
      {s.status !== 'FINALIZADA' && (
        <Card>
          <div className="text-sm font-medium text-slate-600">Avaliar atendimento e finalizar</div>
          <div className="mt-2 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setNota(n)} className={`text-2xl ${n <= nota ? 'text-amber-400' : 'text-slate-300'}`}>★</button>)}
            <button className="btn-primary ml-3" onClick={avaliar} disabled={!nota}>Finalizar</button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Colaborador() {
  const [f, setF] = useState({ nome: '', cpf: '', cargo: '', salario: '', admissao: '' });
  const [ok, setOk] = useState(false);
  async function enviar() { if (!f.nome) return; await portalApi.post('/colaborador', f); setOk(true); }
  if (ok) return <Card><p className="text-emerald-700">Cadastro enviado! O escritorio iniciou o processo de admissao.</p></Card>;
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Cadastrar colaborador</h1>
      <Card>
        <div className="space-y-3">
          <div><label className="label">Nome *</label><input className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">CPF</label><input className="input" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></div>
            <div><label className="label">Cargo</label><input className="input" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} /></div>
            <div><label className="label">Salario</label><input className="input" value={f.salario} onChange={(e) => setF({ ...f, salario: e.target.value })} /></div>
            <div><label className="label">Admissao</label><input type="date" className="input" value={f.admissao} onChange={(e) => setF({ ...f, admissao: e.target.value })} /></div>
          </div>
          <button className="btn-primary" onClick={enviar}>Enviar cadastro</button>
        </div>
      </Card>
    </div>
  );
}

function Lgpd({ onAceito }: { onAceito: () => void }) {
  const [d, setD] = useState<{ texto: string; versao: string; aceito: boolean } | null>(null);
  useEffect(() => { portalApi.get<typeof d>('/lgpd').then(setD); }, []);
  async function aceitar() { await portalApi.post('/lgpd/aceitar'); onAceito(); setD((x) => x ? { ...x, aceito: true } : x); }
  if (!d) return <p className="text-slate-400">Carregando...</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Politica de Privacidade</h1>
      <Card><p className="whitespace-pre-wrap text-sm text-slate-600">{d.texto}</p></Card>
      {d.aceito ? <p className="text-sm text-emerald-700">Voce aceitou a versao {d.versao}.</p> : <button className="btn-primary" onClick={aceitar}>Li e aceito</button>}
    </div>
  );
}

function MeusDados() {
  const [me, setMe] = useState<{ nome: string; email: string } | null>(null);
  const [nome, setNome] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { portalApi.get<{ nome: string; email: string }>('/me').then((m) => { setMe(m); setNome(m.nome); }); }, []);

  async function salvar() {
    setMsg('');
    try {
      const body: Record<string, string> = {};
      if (nome.trim() && nome !== me?.nome) body.nome = nome.trim();
      if (novaSenha) { body.senhaAtual = senhaAtual; body.novaSenha = novaSenha; }
      if (Object.keys(body).length === 0) { setMsg('Nada para atualizar.'); return; }
      await portalApi.put('/perfil', body);
      setMsg('Dados atualizados.'); setSenhaAtual(''); setNovaSenha('');
    } catch (e) { setMsg(e instanceof PortalError ? e.message : 'Erro ao salvar.'); }
  }

  if (!me) return <p className="text-slate-400">Carregando...</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Meus dados</h1>
      <Card>
        <div className="space-y-3">
          <div><label className="label">E-mail (login)</label><input className="input bg-slate-50" value={me.email} disabled /></div>
          <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <hr className="border-slate-100" />
          <p className="text-sm font-medium text-slate-600">Alterar senha (opcional)</p>
          <div><label className="label">Senha atual</label><input className="input" type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} /></div>
          <div><label className="label">Nova senha (min 8)</label><input className="input" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} minLength={8} /></div>
          {msg && <p className="text-sm text-marca-600">{msg}</p>}
          <button className="btn-primary" onClick={salvar}>Salvar</button>
        </div>
      </Card>
    </div>
  );
}

function AvalieNos() {
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar() {
    setErro('');
    if (nota === null) { setErro('Escolha uma nota de 0 a 10.'); return; }
    if (nota <= 8 && !comentario.trim()) { setErro('Para notas ate 8, conte-nos o motivo.'); return; }
    try { await portalApi.post('/nps', { nota, comentario: comentario.trim() || undefined }); setEnviado(true); }
    catch (e) { setErro(e instanceof PortalError ? e.message : 'Erro ao enviar.'); }
  }

  if (enviado) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Avalie-nos</h1>
      <Card><p className="text-sm text-emerald-700">Obrigado pela sua avaliacao! 🙏</p></Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Avalie-nos</h1>
      <Card>
        <p className="text-sm text-slate-600">Em uma escala de 0 a 10, o quanto voce recomendaria nosso escritorio a um amigo ou colega?</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button key={n} onClick={() => setNota(n)}
              className={`h-9 w-9 rounded text-sm font-medium ${nota === n ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              style={nota === n ? { background: n <= 6 ? '#cf3c5d' : n <= 8 ? '#f0ad4e' : '#5cb85c' } : { border: '1px solid #e2e8f0' }}>{n}</button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400"><span>Pouco provavel</span><span>Muito provavel</span></div>
        <div className="mt-3">
          <label className="label">Comentario {nota !== null && nota <= 8 ? '(obrigatorio)' : '(opcional)'}</label>
          <textarea className="input" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Conte-nos o motivo da sua nota" />
        </div>
        {erro && <p className="mt-2 text-sm text-red-500">{erro}</p>}
        <button className="btn-primary mt-3" onClick={enviar}>Enviar avaliacao</button>
      </Card>
    </div>
  );
}

interface ProcLista { id: string; nome: string; status: string; gestor: string | null; dataInicio: string; previsaoConclusao: string | null; progresso: number; total: number; concluidos: number }
interface ProcDetalhe { id: string; nome: string; status: string; gestor: string | null; dataInicio: string; previsaoConclusao: string | null; dataConclusao: string | null; passos: { id: string; titulo: string; descricao: string | null; status: string; prazo: string | null; concluidoEm: string | null }[] }
const COR_PASSO: Record<string, string> = { PENDENTE: '#f0ad4e', EM_ANDAMENTO: '#5b9bd5', CONCLUIDO: '#5cb85c', DISPENSADO: '#94a3b8' };

function Processos() {
  const [lista, setLista] = useState<ProcLista[] | null>(null);
  const [aberto, setAberto] = useState<ProcDetalhe | null>(null);
  useEffect(() => { portalApi.get<ProcLista[]>('/processos').then(setLista).catch(() => setLista([])); }, []);

  function abrir(id: string) { portalApi.get<ProcDetalhe>(`/processos/${id}`).then(setAberto); }

  if (!lista) return <p className="text-slate-400">Carregando...</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Processos</h1>
      <p className="text-sm text-slate-500">Acompanhe o andamento dos processos da sua empresa.</p>
      {lista.length === 0 && <Card><p className="text-sm text-slate-400">Nenhum processo em andamento.</p></Card>}
      {lista.map((p) => (
        <button key={p.id} className="block w-full text-left" onClick={() => abrir(p.id)}>
          <Card>
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-700">{p.nome}</div>
              <span className="text-xs text-slate-400">{p.status === 'EM_ANDAMENTO' ? 'Em andamento' : p.status === 'SUSPENSO' ? 'Suspenso' : p.status}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{p.gestor ? `Gestor: ${p.gestor} · ` : ''}Inicio: {new Date(p.dataInicio).toLocaleDateString('pt-BR')}{p.previsaoConclusao ? ` · Previsao: ${new Date(p.previsaoConclusao).toLocaleDateString('pt-BR')}` : ''}</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${p.progresso}%` }} /></div>
            <div className="mt-1 text-xs text-slate-500">{p.progresso}% · {p.concluidos}/{p.total} etapas</div>
          </Card>
        </button>
      ))}
      {aberto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setAberto(null)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800">{aberto.nome}</h2>
            <p className="text-xs text-slate-400">{aberto.gestor ? `Gestor: ${aberto.gestor}` : ''}</p>
            <div className="mt-3 space-y-2">
              {aberto.passos.length === 0 && <p className="text-sm text-slate-400">Nenhuma etapa compartilhada.</p>}
              {aberto.passos.map((s) => (
                <div key={s.id} className="flex items-start gap-2 border-b border-slate-100 pb-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: COR_PASSO[s.status] ?? '#94a3b8' }} />
                  <div>
                    <div className="text-sm text-slate-700">{s.titulo}</div>
                    {s.descricao && <div className="text-xs text-slate-400">{s.descricao}</div>}
                    <div className="text-xs text-slate-400">{s.status === 'CONCLUIDO' && s.concluidoEm ? `Concluido em ${new Date(s.concluidoEm).toLocaleDateString('pt-BR')}` : s.prazo ? `Prazo: ${new Date(s.prazo).toLocaleDateString('pt-BR')}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end"><button className="btn-ghost" onClick={() => setAberto(null)}>Fechar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CobItemCli { id: string; nome: string; status: string; temArquivo: boolean; justificativa: string | null }
interface CobCli { id: string; reguaNome: string; competencia: string; dataLimite: string; status: string; itens: CobItemCli[] }
const COR_COB: Record<string, string> = { PENDENTE: '#f0ad4e', VENCIDO: '#cf3c5d', RECEBIDO: '#5b9bd5', VALIDADO: '#5cb85c', RECUSADO: '#cf3c5d' };

function EnviarDocumentos() {
  const [lista, setLista] = useState<CobCli[] | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  function carregar() { portalApi.get<CobCli[]>('/cobrancas').then(setLista).catch(() => setLista([])); }
  useEffect(carregar, []);

  async function enviar(cobId: string, itemId: string, file: File) {
    setEnviando(itemId);
    try {
      const fd = new FormData(); fd.append('arquivo', file);
      const res = await fetch(`/api/v1/portal/cobrancas/${cobId}/itens/${itemId}/enviar`, { method: 'POST', headers: portalApi.authHeaders(), body: fd });
      if (!res.ok) throw new Error();
      carregar();
    } catch { alert('Falha ao enviar o documento.'); }
    finally { setEnviando(null); }
  }

  if (!lista) return <p className="text-slate-400">Carregando...</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Enviar documentos</h1>
      <p className="text-sm text-slate-500">Anexe os documentos solicitados pelo seu escritorio contabil.</p>
      {lista.length === 0 && <Card><p className="text-sm text-slate-400">Nenhum documento solicitado no momento.</p></Card>}
      {lista.map((c) => (
        <Card key={c.id}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-700">{c.reguaNome} · {c.competencia}</div>
              <div className="text-xs text-slate-400">Limite: {new Date(c.dataLimite).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</div>
            </div>
            <span className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ background: COR_COB[c.status] ?? '#94a3b8' }}>{c.status}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {c.itens.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <div className="text-sm text-slate-700">{it.nome}</div>
                  {it.status === 'RECUSADO' && it.justificativa && <div className="text-xs text-red-500">Recusado: {it.justificativa}. Reenvie.</div>}
                  {it.status === 'VALIDADO' && <div className="text-xs text-emerald-600">Validado ✓</div>}
                  {it.status === 'RECEBIDO' && <div className="text-xs text-sky-600">Recebido, aguardando validacao</div>}
                </div>
                {it.status !== 'VALIDADO' && (
                  <label className="cursor-pointer rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
                    {enviando === it.id ? 'Enviando...' : it.temArquivo ? 'Reenviar' : 'Anexar documento'}
                    <input type="file" className="hidden" disabled={enviando === it.id} onChange={(e) => e.target.files?.[0] && enviar(c.id, it.id, e.target.files[0])} />
                  </label>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
