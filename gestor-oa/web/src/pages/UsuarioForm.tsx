import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, RotateCcw, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Spinner, useToast } from '../components/ui';
import type { UsuarioCompleto, Departamento, Tag, JanelaAcesso } from '../lib/tipos';
import { PERMISSION_GROUPS, TIPOS_USUARIO } from '../lib/tipos';

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
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({});
  const [depIds, setDepIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [blocos, setBlocos] = useState(janelasParaBlocos([]));

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // secoes colapsaveis (estilo Acessorias)
  const [showPerm, setShowPerm] = useState(false);
  const [showCusto, setShowCusto] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);

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
      setPermissoes(u.permissoes ?? {});
      setDepIds(u.filtrosForcados?.departamentos ?? []);
      setTagIds(u.filtrosForcados?.tags ?? []);
      setBlocos(janelasParaBlocos(u.horariosAcesso ?? []));
    }).catch(() => toast('erro', 'Usuario nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  function togglePerm(flag: string) { setPermissoes((p) => ({ ...p, [flag]: !p[flag] })); }
  function marcarGrupo(flags: string[], v: boolean) { setPermissoes((p) => { const n = { ...p }; flags.forEach((f) => (n[f] = v)); return n; }); }
  function setBloco(chave: 'domingo' | 'semana' | 'sabado', patch: Partial<AcessoBloco>) {
    setBlocos((b) => ({ ...b, [chave]: { ...b[chave], ...patch } }));
  }

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome.');
    if (novo && senha.length < 8) return toast('erro', 'Senha minima de 8 caracteres.');
    setSalvando(true);
    try {
      const payload = {
        nome, ativo, permissoes, tipo: tipo || null,
        telefone: telefone || null, observacoes: observacoes || null,
        custoHora: custoHora === '' ? null : Number(custoHora),
        minutosUteisMes: minutosUteisMes === '' ? null : Number(minutosUteisMes),
        horariosAcesso: blocosParaJanelas(blocos),
        filtrosForcados: { departamentos: depIds, tags: tagIds },
      };
      if (novo) {
        await api.post('/usuarios', { ...payload, email, senha });
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

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">Sistema › Usuarios e Permissoes › <span className="text-slate-700">{novo ? 'Novo usuario' : 'Cadastro de usuario e suas permissoes'}</span></div>

      {/* Linha principal: Nome / E-mail / Senha / Tipo */}
      <div className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
        <div>
          <label className="label flex items-center justify-between">Nome {!novo && id && <span className="text-xs font-normal text-marca-500">ID: {id.slice(-6)}</span>}</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="label">E-Mail / Usuario de acesso</label>
          <input className="input" value={email} disabled={!novo} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Senha</label>
          <input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Em branco = manter a mesma" />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_USUARIO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Secoes colapsaveis */}
      <div className="card divide-y divide-slate-100">
        <SecaoLink aberto={showPerm} onToggle={() => setShowPerm((v) => !v)} titulo="Permissoes desse usuario" />
        {showPerm && (
          <div className="space-y-4 p-5">
            {!podePermissoes && <p className="text-sm text-amber-600">Voce nao tem permissao para alterar permissoes (apenas visualizacao).</p>}
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.grupo}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{g.grupo}</span>
                  {podePermissoes && (
                    <span className="flex gap-2 text-xs">
                      <button className="text-marca-600 hover:underline" onClick={() => marcarGrupo(g.flags.map((f) => f.flag), true)}>todos</button>
                      <button className="text-slate-400 hover:underline" onClick={() => marcarGrupo(g.flags.map((f) => f.flag), false)}>nenhum</button>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
                  {g.flags.map((f) => (
                    <label key={f.flag} className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" disabled={!podePermissoes} checked={!!permissoes[f.flag]} onChange={() => togglePerm(f.flag)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <SecaoLink aberto={showCusto} onToggle={() => setShowCusto((v) => !v)} titulo="Configuracao do custo e minutos uteis do colaborador" />
        {showCusto && (
          <div className="space-y-3 p-5">
            <p className="text-sm text-slate-500">Alimenta o Metodo APLA (produtividade e lucratividade). Em branco usa o custo/hora padrao do escritorio.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label">Custo por hora (R$)</label><input className="input" type="number" min={0} step="0.01" value={custoHora} onChange={(e) => setCustoHora(e.target.value)} placeholder="Ex.: 45.00" /></div>
              <div><label className="label">Minutos uteis no mes</label><input className="input" type="number" min={0} value={minutosUteisMes} onChange={(e) => setMinutosUteisMes(e.target.value)} placeholder="Ex.: 8800" /></div>
            </div>
          </div>
        )}

        <SecaoLink aberto={showFiltros} onToggle={() => setShowFiltros((v) => !v)} titulo="Filtros de visao (departamentos / tags)" />
        {showFiltros && (
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-500">Restringe a visao do usuario. Vazio = sem restricao.</p>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Departamentos</div>
              <div className="flex flex-wrap gap-3">
                {departamentos.map((d) => (
                  <label key={d.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={depIds.includes(d.id)} onChange={(e) => setDepIds((ids) => e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id))} />{d.nome}</label>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Tags</div>
              <div className="flex flex-wrap gap-3">
                {tags.map((t) => (
                  <label key={t.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={tagIds.includes(t.id)} onChange={(e) => setTagIds((ids) => e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id))} />{t.nome}</label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ativo + Acessos por dia */}
      <div className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
        <div>
          <label className="label">Usuario Ativo?</label>
          <select className="input" value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}>
            <option value="sim">Sim</option>
            <option value="nao">Nao</option>
          </select>
        </div>
        <BlocoAcesso titulo="Acesso de Domingo?" bloco={blocos.domingo} onChange={(p) => setBloco('domingo', p)} />
        <BlocoAcesso titulo="Acesso de Seg. a Sexta?" bloco={blocos.semana} onChange={(p) => setBloco('semana', p)} />
        <BlocoAcesso titulo="Acesso de Sabado?" bloco={blocos.sabado} onChange={(p) => setBloco('sabado', p)} />
      </div>

      {/* Complementares + Fone + acoes */}
      <div className="card grid grid-cols-1 items-end gap-4 p-5 md:grid-cols-3">
        <div>
          <label className="label">Dados complementares</label>
          <input className="input" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Comentarios" />
        </div>
        <div>
          <label className="label">Fone(s)</label>
          <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Fone" />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-primary bg-status-ok hover:bg-emerald-600" onClick={salvar} disabled={salvando}><Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
          <button className="btn-primary bg-status-warn hover:bg-amber-500" onClick={() => navigate('/usuarios')}><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      {!novo && (
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-200 py-3 text-sm text-slate-600 hover:bg-slate-300" onClick={() => navigate('/empresas')}>
          <Building2 size={16} /> Visualizar as empresas que este colaborador tem departamentos sob responsabilidade
        </button>
      )}
    </div>
  );
}

function SecaoLink({ aberto, onToggle, titulo }: { aberto: boolean; onToggle: () => void; titulo: string }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium text-marca-700 hover:bg-slate-50">
      {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      {titulo} <span className="text-xs font-normal text-slate-400">(clique para {aberto ? 'ocultar' : 'exibir'})</span>
    </button>
  );
}

function BlocoAcesso({ titulo, bloco, onChange }: { titulo: string; bloco: AcessoBloco; onChange: (p: Partial<AcessoBloco>) => void }) {
  return (
    <div>
      <label className="label text-status-danger">{titulo}</label>
      <div className="flex gap-1">
        <select className="input" value={bloco.permitido ? 'p' : 'b'} onChange={(e) => onChange({ permitido: e.target.value === 'p' })}>
          <option value="b">Bloqueado</option>
          <option value="p">Permitido</option>
        </select>
        <input type="time" className="input w-24" value={bloco.inicio} disabled={!bloco.permitido} onChange={(e) => onChange({ inicio: e.target.value })} />
        <input type="time" className="input w-24" value={bloco.fim} disabled={!bloco.permitido} onChange={(e) => onChange({ fim: e.target.value })} />
      </div>
    </div>
  );
}
