import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, RotateCcw, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Spinner, useToast } from '../components/ui';
import type { UsuarioCompleto, JanelaAcesso } from '../lib/tipos';
import { PERMISSION_GROUPS, TIPOS_USUARIO } from '../lib/tipos';

// Classes compactas (flat, fundo cinza) - estilo Acessorias
const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 block text-[12px] font-medium text-slate-600';

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

  // secao colapsavel de permissoes (estilo Acessorias)
  const [showPerm, setShowPerm] = useState(false);

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

      {/* Secoes colapsaveis (links chapados) */}
      <div className="mt-3 space-y-1">
        <SecaoLink aberto={showPerm} onToggle={() => setShowPerm((v) => !v)} titulo="Permissoes desse usuario" />
        {showPerm && (
          <div className="space-y-4 rounded border border-slate-200 bg-white p-4">
            {!podePermissoes && <p className="text-sm text-amber-600">Voce nao tem permissao para alterar permissoes (apenas visualizacao).</p>}
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.grupo}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-700">{g.grupo}</span>
                  {podePermissoes && (
                    <span className="flex gap-2 text-xs">
                      <button className="text-marca-600 hover:underline" onClick={() => marcarGrupo(g.flags.map((f) => f.flag), true)}>todos</button>
                      <button className="text-slate-400 hover:underline" onClick={() => marcarGrupo(g.flags.map((f) => f.flag), false)}>nenhum</button>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
                  {g.flags.map((f) => (
                    <label key={f.flag} className="flex items-center gap-2 text-[12px] text-slate-600">
                      <input type="checkbox" disabled={!podePermissoes} checked={!!permissoes[f.flag]} onChange={() => togglePerm(f.flag)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
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

function SecaoLink({ aberto, onToggle, titulo }: { aberto: boolean; onToggle: () => void; titulo: string }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-1 text-left text-[13px] font-medium text-marca-700 hover:underline">
      {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      {titulo} <span className="font-normal text-marca-500">(clique para {aberto ? 'ocultar' : 'exibir'})</span>
    </button>
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
