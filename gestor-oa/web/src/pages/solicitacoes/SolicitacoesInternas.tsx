import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';

interface Departamento { id: string; nome: string }
interface UsuarioBasico { id: string; nome: string }
interface EmpresaLista { id: string; razaoSocial: string }
interface Matriz { id: string; nome: string }

interface Solicitacao {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string | null;
  prioridade: string;
  status: string;
  solicitanteId: string;
  responsavelId: string | null;
  departamentoDestinoId: string | null;
  empresaId: string | null;
  processoId: string | null;
  prazo: string | null;
  createdAt: string;
  solicitanteNome: string | null;
  responsavelNome: string | null;
  departamentoDestinoNome: string | null;
  empresaNome: string | null;
  _count?: { mensagens: number };
}
interface Mensagem { id: string; autorNome: string; texto: string; evento: string | null; createdAt: string }
interface Stats { porStatus: Record<string, number>; atrasadas: number; minhas: number }

const STATUS_LABEL: Record<string, string> = {
  ABERTA: 'Aberta', EM_ANDAMENTO: 'Em andamento', AGUARDANDO: 'Aguardando', RESOLVIDA: 'Resolvida', CANCELADA: 'Cancelada',
};
const STATUS_CLASSE: Record<string, string> = {
  ABERTA: 'bg-sky-100 text-sky-700',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-700',
  AGUARDANDO: 'bg-violet-100 text-violet-700',
  RESOLVIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-slate-200 text-slate-500',
};
const PRIO_LABEL: Record<string, string> = { BAIXA: 'Baixa', MEDIA: 'Media', ALTA: 'Alta', URGENTE: 'Urgente' };
const PRIO_CLASSE: Record<string, string> = {
  BAIXA: 'bg-slate-100 text-slate-500',
  MEDIA: 'bg-sky-100 text-sky-700',
  ALTA: 'bg-orange-100 text-orange-700',
  URGENTE: 'bg-red-100 text-red-700',
};

export default function SolicitacoesInternas() {
  const toast = useToast();
  const { sessao } = useAuth();
  const podeGerenciar = !!sessao?.usuario.permissoes['solicitacoes_internas_gerenciar'];

  const [itens, setItens] = useState<Solicitacao[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);

  const [fStatus, setFStatus] = useState('');
  const [fPrioridade, setFPrioridade] = useState('');
  const [fDepto, setFDepto] = useState('');
  const [fMinhas, setFMinhas] = useState(false);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLista[]>([]);

  function carregar() {
    const qs = new URLSearchParams();
    if (fStatus) qs.set('status', fStatus);
    if (fPrioridade) qs.set('prioridade', fPrioridade);
    if (fDepto) qs.set('departamentoDestinoId', fDepto);
    if (fMinhas) qs.set('minhas', 'true');
    setLoading(true);
    api.get<Solicitacao[]>(`/solicitacoes-internas?${qs.toString()}`).then(setItens).finally(() => setLoading(false));
    api.get<Stats>('/solicitacoes-internas/stats').then(setStats).catch(() => undefined);
  }
  useEffect(carregar, [fStatus, fPrioridade, fDepto, fMinhas]);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
    api.get<{ items: EmpresaLista[] }>('/empresas?limit=100').then((p) => setEmpresas(p.items)).catch(() => undefined);
  }, []);

  if (aberta) {
    return (
      <Detalhe
        id={aberta}
        podeGerenciar={podeGerenciar}
        departamentos={departamentos}
        usuarios={usuarios}
        empresas={empresas}
        onVoltar={() => { setAberta(null); carregar(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-800">Solicitacoes internas</h1>
        <button className="btn-primary" onClick={() => setNovaAberta(true)}>+ Nova solicitacao</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <CardStat titulo="Abertas" valor={stats.porStatus.ABERTA ?? 0} cor="text-sky-600" />
          <CardStat titulo="Em andamento" valor={stats.porStatus.EM_ANDAMENTO ?? 0} cor="text-amber-600" />
          <CardStat titulo="Aguardando" valor={stats.porStatus.AGUARDANDO ?? 0} cor="text-violet-600" />
          <CardStat titulo="Atrasadas" valor={stats.atrasadas} cor="text-red-600" />
          <CardStat titulo="Minhas (em aberto)" valor={stats.minhas} cor="text-marca-600" />
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <select className="input w-40" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-36" value={fPrioridade} onChange={(e) => setFPrioridade(e.target.value)}>
          <option value="">Toda prioridade</option>
          {Object.entries(PRIO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-48" value={fDepto} onChange={(e) => setFDepto(e.target.value)}>
          <option value="">Todos os setores</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={fMinhas} onChange={(e) => setFMinhas(e.target.checked)} /> Apenas as minhas
        </label>
      </div>

      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Titulo</th>
                <th className="px-3 py-2">Setor destino</th>
                <th className="px-3 py-2">Responsavel</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Prazo</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((s) => {
                const atrasada = s.prazo && !['RESOLVIDA', 'CANCELADA'].includes(s.status) && new Date(s.prazo) < new Date();
                return (
                  <tr key={s.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setAberta(s.id)}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-700">{s.titulo}</div>
                      <div className="text-xs text-slate-400">por {s.solicitanteNome ?? '—'} · {new Date(s.createdAt).toLocaleDateString('pt-BR')}{s.processoId ? ' · com processo' : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{s.departamentoDestinoNome ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{s.responsavelNome ?? <span className="text-orange-500">sem dono</span>}</td>
                    <td className="px-3 py-2 text-slate-500">{s.empresaNome ?? '—'}</td>
                    <td className="px-3 py-2"><Badge className={PRIO_CLASSE[s.prioridade]}>{PRIO_LABEL[s.prioridade]}</Badge></td>
                    <td className={`px-3 py-2 ${atrasada ? 'font-medium text-red-600' : 'text-slate-500'}`}>{s.prazo ? new Date(s.prazo).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-3 py-2"><Badge className={STATUS_CLASSE[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                  </tr>
                );
              })}
              {itens.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Nenhuma solicitacao.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal aberto={novaAberta} titulo="Nova solicitacao interna" onFechar={() => setNovaAberta(false)} largura="max-w-xl">
        <FormNova
          departamentos={departamentos}
          usuarios={usuarios}
          empresas={empresas}
          onSalvo={() => { setNovaAberta(false); carregar(); }}
          onErro={(m) => toast('erro', m)}
        />
      </Modal>
    </div>
  );
}

function CardStat({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{titulo}</div>
      <div className={`text-2xl font-bold ${cor}`}>{valor}</div>
    </div>
  );
}

function FormNova({ departamentos, usuarios, empresas, onSalvo, onErro }: {
  departamentos: Departamento[]; usuarios: UsuarioBasico[]; empresas: EmpresaLista[];
  onSalvo: () => void; onErro: (m: string) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [prioridade, setPrioridade] = useState('MEDIA');
  const [departamentoDestinoId, setDepto] = useState('');
  const [responsavelId, setResp] = useState('');
  const [empresaId, setEmpresa] = useState('');
  const [prazo, setPrazo] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (titulo.trim().length < 2 || descricao.trim().length < 2) { onErro('Preencha titulo e descricao.'); return; }
    setSalvando(true);
    try {
      await api.post('/solicitacoes-internas', {
        titulo, descricao, categoria: categoria || null, prioridade,
        departamentoDestinoId: departamentoDestinoId || null, responsavelId: responsavelId || null,
        empresaId: empresaId || null, prazo: prazo || null,
      });
      onSalvo();
    } catch (e) { onErro(e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="space-y-3">
      <input className="input w-full" placeholder="Titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <textarea className="input w-full" rows={4} placeholder="Descreva a solicitacao..." value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input className="input" placeholder="Categoria (opcional)" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        <select className="input" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
          {Object.entries(PRIO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={departamentoDestinoId} onChange={(e) => setDepto(e.target.value)}>
          <option value="">Setor de destino...</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select className="input" value={responsavelId} onChange={(e) => setResp(e.target.value)}>
          <option value="">Responsavel...</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select className="input" value={empresaId} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Empresa (opcional)...</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
        </select>
        <input className="input" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Criar solicitacao'}</button>
      </div>
    </div>
  );
}

function Detalhe({ id, podeGerenciar, departamentos, usuarios, empresas, onVoltar }: {
  id: string; podeGerenciar: boolean;
  departamentos: Departamento[]; usuarios: UsuarioBasico[]; empresas: EmpresaLista[];
  onVoltar: () => void;
}) {
  const toast = useToast();
  const [s, setS] = useState<Solicitacao | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [matrizId, setMatrizId] = useState('');

  function carregar() {
    api.get<Solicitacao & { mensagens: Mensagem[] }>(`/solicitacoes-internas/${id}`).then((d) => {
      setMensagens(d.mensagens ?? []);
      setS(d);
    });
  }
  useEffect(carregar, [id]);
  useEffect(() => { api.get<Matriz[]>('/matrizes').then(setMatrizes).catch(() => undefined); }, []);

  if (!s) return <Spinner />;

  async function acao(fn: () => Promise<unknown>, msgOk?: string) {
    try { await fn(); if (msgOk) toast('ok', msgOk); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  const enviar = () => { if (!texto.trim()) return; acao(async () => { await api.post(`/solicitacoes-internas/${id}/mensagem`, { texto }); setTexto(''); }); };
  const mudarStatus = (status: string) => acao(() => api.post(`/solicitacoes-internas/${id}/status`, { status }));
  const assumir = () => acao(() => api.post(`/solicitacoes-internas/${id}/assumir`), 'Voce assumiu a solicitacao.');
  const atualizar = (campo: string, valor: string | null) => acao(() => api.put(`/solicitacoes-internas/${id}`, { [campo]: valor }));
  const gerarProcesso = () => { if (!matrizId) { toast('erro', 'Escolha uma matriz.'); return; } acao(() => api.post(`/solicitacoes-internas/${id}/gerar-processo`, { matrizId }), 'Processo gerado.'); };
  const excluir = () => { if (confirm('Excluir esta solicitacao?')) acao(async () => { await api.del(`/solicitacoes-internas/${id}`); onVoltar(); }); };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <button onClick={onVoltar} className="text-sm text-marca-600 hover:underline">← Voltar</button>
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-800">{s.titulo}</h1>
            <Badge className={STATUS_CLASSE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
            <Badge className={PRIO_CLASSE[s.prioridade]}>{PRIO_LABEL[s.prioridade]}</Badge>
          </div>
          <div className="mt-1 text-xs text-slate-400">Aberta por {s.solicitanteNome ?? '—'} em {new Date(s.createdAt).toLocaleString('pt-BR')}{s.categoria ? ` · ${s.categoria}` : ''}</div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{s.descricao}</p>
        </div>

        <div className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-slate-700">Conversa / historico</h2>
          {mensagens.map((m) => (
            <div key={m.id} className={`rounded p-2 text-sm ${m.evento ? 'bg-slate-50 text-slate-500 italic' : 'bg-marca-50'}`}>
              <div className="text-xs text-slate-400">{m.autorNome} · {new Date(m.createdAt).toLocaleString('pt-BR')}</div>
              <div className={m.evento ? '' : 'text-slate-700'}>{m.texto}</div>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <input className="input flex-1" placeholder="Escrever uma mensagem..." value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} />
            <button className="btn-primary" onClick={enviar}>Enviar</button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-slate-700">Gestao</h2>

          <label className="block text-xs text-slate-500">Status
            <select className="input mt-1 w-full" value={s.status} onChange={(e) => mudarStatus(e.target.value)}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>

          <label className="block text-xs text-slate-500">Responsavel
            <select className="input mt-1 w-full" value={s.responsavelId ?? ''} disabled={!podeGerenciar} onChange={(e) => atualizar('responsavelId', e.target.value || null)}>
              <option value="">Sem responsavel</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          {!s.responsavelId && <button className="btn-ghost border border-slate-300 w-full" onClick={assumir}>Assumir solicitacao</button>}

          <label className="block text-xs text-slate-500">Setor de destino
            <select className="input mt-1 w-full" value={s.departamentoDestinoId ?? ''} disabled={!podeGerenciar} onChange={(e) => atualizar('departamentoDestinoId', e.target.value || null)}>
              <option value="">Sem setor</option>
              {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </label>

          <label className="block text-xs text-slate-500">Prioridade
            <select className="input mt-1 w-full" value={s.prioridade} disabled={!podeGerenciar} onChange={(e) => atualizar('prioridade', e.target.value)}>
              {Object.entries(PRIO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>

          <label className="block text-xs text-slate-500">Empresa
            <select className="input mt-1 w-full" value={s.empresaId ?? ''} disabled={!podeGerenciar} onChange={(e) => atualizar('empresaId', e.target.value || null)}>
              <option value="">Sem empresa</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
            </select>
          </label>
        </div>

        {podeGerenciar && (
          <div className="card space-y-2 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Gerar processo (Modulo 6)</h2>
            {s.processoId ? (
              <p className="text-sm text-emerald-600">Processo ja vinculado a esta solicitacao.</p>
            ) : (
              <>
                <p className="text-xs text-slate-500">Instancia uma matriz de processo para a empresa vinculada.</p>
                <select className="input w-full" value={matrizId} onChange={(e) => setMatrizId(e.target.value)} disabled={!s.empresaId}>
                  <option value="">Escolha a matriz...</option>
                  {matrizes.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                {!s.empresaId && <p className="text-xs text-orange-500">Vincule uma empresa primeiro.</p>}
                <button className="btn-ghost border border-slate-300 w-full" onClick={gerarProcesso} disabled={!s.empresaId}>Gerar processo</button>
              </>
            )}
          </div>
        )}

        {podeGerenciar && (
          <button className="text-sm text-red-600 hover:underline" onClick={excluir}>Excluir solicitacao</button>
        )}
      </div>
    </div>
  );
}
