import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Search, Save, RotateCcw, Pencil, Trash2, Eye, EyeOff, RefreshCw, Info, CalendarDays,
  MapPin, MessageCircle, Tag as TagIcon, CheckSquare, Users, List, LayoutTemplate, CheckCircle2,
  MessagesSquare, Network, Paperclip,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui';
import type { Regime, GrupoEmpresa } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 block text-[13px] font-bold text-slate-700';
const fmtCep = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const fmtFone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 10) return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_m, a, b, c) => [a && `(${a}`, a.length === 2 && ') ', b, c && `-${c}`].filter(Boolean).join(''));
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, (_m, a, b, c) => `(${a}) ${b}${c ? `-${c}` : ''}`);
};

// As 12 secoes (mesma faixa da ficha). No cadastro, so Endereco e' editavel antes de salvar.
const SECOES: { key: string; icon: typeof MapPin; titulo: string }[] = [
  { key: 'endereco', icon: MapPin, titulo: 'Endereco e inscricoes' },
  { key: 'comentarios', icon: MessageCircle, titulo: 'Comentarios e anotacoes gerais' },
  { key: 'tags', icon: TagIcon, titulo: 'Tags da empresa' },
  { key: 'processos', icon: CheckSquare, titulo: 'Gestao de Processos' },
  { key: 'contatos', icon: Users, titulo: 'Contatos na empresa' },
  { key: 'obrigacoes', icon: List, titulo: 'Obrigacoes dessa empresa' },
  { key: 'gruposEnvio', icon: LayoutTemplate, titulo: 'Grupo de obrigacoes para envio de e-mails agrupados' },
  { key: 'tarefas', icon: CheckCircle2, titulo: 'Tarefas agendadas' },
  { key: 'recorrentes', icon: RefreshCw, titulo: 'Processos recorrentes dessa empresa' },
  { key: 'solicitacoes', icon: MessagesSquare, titulo: 'Solicitacoes App' },
  { key: 'responsaveis', icon: Network, titulo: 'Responsaveis pelos departamentos' },
  { key: 'anexos', icon: Paperclip, titulo: 'Arquivos anexos' },
];

export default function EmpresaForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { sessao } = useAuth();

  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [proximoId, setProximoId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [verHonorario, setVerHonorario] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [aberta, setAberta] = useState<string>('endereco');

  const [f, setF] = useState({
    cnpj: '', razaoSocial: '', nomeFantasia: '', apelidoEcontinuo: '', grupoEmpresaId: '',
    honorario: '', regimeTributarioId: '', ativo: true,
    cep: '', logradouro: '', numeroEndereco: '', complemento: '', bairro: '', cidade: '', uf: '', telefone: '',
  });
  function s<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((x) => ({ ...x, [k]: v })); }

  useEffect(() => {
    api.get<Regime[]>('/regimes').then(setRegimes).catch(() => undefined);
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
    api.get<{ numero: number }>('/empresas/proximo-numero').then((r) => setProximoId(r.numero)).catch(() => undefined);
  }, []);

  async function buscarCnpj() {
    const dig = f.cnpj.replace(/\D/g, '');
    if (dig.length !== 14 || buscandoCnpj) return;
    setBuscandoCnpj(true);
    try {
      const d = await api.get<{ razaoSocial: string; nomeFantasia: string; cep: string; logradouro: string; numeroEndereco: string; complemento: string; bairro: string; cidade: string; uf: string; telefone: string; email: string }>(`/empresas/consulta-cnpj/${dig}`);
      setF((x) => ({
        ...x,
        razaoSocial: x.razaoSocial || d.razaoSocial, nomeFantasia: x.nomeFantasia || d.nomeFantasia,
        cep: x.cep || d.cep, logradouro: x.logradouro || d.logradouro, numeroEndereco: x.numeroEndereco || d.numeroEndereco,
        complemento: x.complemento || d.complemento, bairro: x.bairro || d.bairro, cidade: x.cidade || d.cidade, uf: x.uf || d.uf,
        telefone: x.telefone || d.telefone,
      }));
      toast('ok', 'Dados do CNPJ preenchidos.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Nao foi possivel consultar o CNPJ.'); }
    finally { setBuscandoCnpj(false); }
  }

  async function salvar() {
    if (f.razaoSocial.trim().length < 2) return toast('erro', 'Informe a Razao Social.');
    setSalvando(true);
    try {
      const dig = f.cnpj.replace(/\D/g, '');
      const empresa = await api.post<{ id: string }>('/empresas', {
        razaoSocial: f.razaoSocial, nomeFantasia: f.nomeFantasia || undefined, apelidoEcontinuo: f.apelidoEcontinuo || undefined,
        grupoEmpresaId: f.grupoEmpresaId || undefined, honorario: f.honorario === '' ? undefined : Number(f.honorario),
        regimeTributarioId: f.regimeTributarioId || undefined, ativo: f.ativo,
        cep: f.cep || undefined, logradouro: f.logradouro || undefined, numeroEndereco: f.numeroEndereco || undefined,
        complemento: f.complemento || undefined, bairro: f.bairro || undefined, cidade: f.cidade || undefined, uf: f.uf || undefined,
        telefone: f.telefone || undefined,
        identificadores: dig.length >= 11 ? [{ tipo: dig.length === 11 ? 'CPF' : 'CNPJ', valor: dig }] : undefined,
      });
      toast('ok', 'Empresa criada. Preencha as demais secoes.');
      navigate(`/empresas/${empresa.id}`);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* breadcrumb */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Heart size={16} className="text-slate-400" /><span className="text-slate-300">&rsaquo;</span>
          <span>Empresas</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-700">Cadastro de empresa cliente do escritorio</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400"><Search size={13} /><span className="text-[12px]">Central de ajuda</span></div>
      </div>

      {/* Linha 1 */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.7fr]">
        <div>
          <label className={LBL}>CNPJ / CPF / CAEPF</label>
          <input className={INP} value={f.cnpj} placeholder="CNPJ (preenche os dados ao sair do campo)" onChange={(e) => s('cnpj', e.target.value)} onBlur={buscarCnpj} />
          {buscandoCnpj && <span className="text-[11px] font-medium text-marca-600">buscando dados do CNPJ...</span>}
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Regime tributario</label>
            <button title="Cadastro de regimes" onClick={() => navigate('/obrigacoes/regimes')} className="text-marca-500 hover:text-marca-700"><Pencil size={13} /></button>
            <button title="Limpar regime" onClick={() => s('regimeTributarioId', '')} className="ml-auto text-status-danger hover:text-red-700"><Trash2 size={14} /></button>
          </div>
          <select className={INP} value={f.regimeTributarioId} onChange={(e) => s('regimeTributarioId', e.target.value)}>
            <option value="">Indefinido</option>
            {regimes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Grupo de empresas</label>
            <button title="Cadastro de grupos" onClick={() => navigate('/empresas/grupos')} className="text-marca-500 hover:text-marca-700"><Pencil size={13} /></button>
          </div>
          <select className={INP} value={f.grupoEmpresaId} onChange={(e) => s('grupoEmpresaId', e.target.value)}>
            <option value="">Geral</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Honorario</label>
            <button title="Exibir/ocultar" onClick={() => setVerHonorario((v) => !v)} className="text-marca-500 hover:text-marca-700">{verHonorario ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
          <input className={INP} type={verHonorario ? 'number' : 'password'} step="0.01" min="0" value={f.honorario} onChange={(e) => s('honorario', e.target.value)} />
        </div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>ID Empresa</label>
            <button title="Sugerir novo ID" onClick={() => api.get<{ numero: number }>('/empresas/proximo-numero').then((r) => setProximoId(r.numero)).catch(() => undefined)} className="text-status-warn hover:text-amber-600"><RefreshCw size={13} /></button>
          </div>
          <input className={`${INP} bg-slate-100`} value={proximoId ?? ''} readOnly />
        </div>
      </div>

      {/* Linha 2 */}
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[1.6fr_0.6fr_1.2fr_1fr]">
        <div><label className={LBL}>Razao Social</label><input className={INP} value={f.razaoSocial} onChange={(e) => s('razaoSocial', e.target.value)} /></div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Ativa?</label><CalendarDays size={13} className="text-status-danger" /></div>
          <select className={INP} value={f.ativo ? 'sim' : 'nao'} onChange={(e) => s('ativo', e.target.value === 'sim')}><option value="sim">Sim</option><option value="nao">Nao</option></select>
        </div>
        <div><label className={LBL}>Nome Fantasia</label><input className={INP} value={f.nomeFantasia} onChange={(e) => s('nomeFantasia', e.target.value)} /></div>
        <div>
          <div className="flex items-center gap-2"><label className={LBL}>Apelido e-Continuo</label><Info size={13} className="text-marca-400" /></div>
          <input className={INP} value={f.apelidoEcontinuo} placeholder="Em branco = ID" onChange={(e) => s('apelidoEcontinuo', e.target.value)} />
        </div>
      </div>

      {/* Faixa de icones + Salvar/Voltar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[13px] text-slate-600">Selecione a secao desejada para exibir/ocultar:</p>
          <div className="flex flex-wrap items-center gap-3">
            {SECOES.map(({ key, icon: Icon, titulo }) => (
              <button key={key} title={titulo} onClick={() => setAberta((a) => (a === key ? '' : key))} className={`transition-colors ${aberta === key ? 'text-status-ok' : 'text-slate-400 hover:text-slate-600'}`}>
                <Icon size={20} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <span className="self-center text-[12px] font-bold text-slate-600">Cadastro: {hoje} [{sessao?.usuario?.nome ?? ''}]</span>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-6 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? '...' : 'Salvar'}</button>
          <button onClick={() => navigate('/empresas')} className="flex items-center gap-2 rounded-md bg-status-warn px-6 py-2 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      {/* Secao aberta */}
      {aberta && (
        <div className="mt-4 py-2">
          <p className="mb-2 text-[13px] font-bold text-slate-700">{SECOES.find((x) => x.key === aberta)?.titulo} <span className="font-normal text-status-danger">(clique no icone para ocultar)</span></p>
          {aberta === 'endereco' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_0.7fr_1fr_1fr]">
                <div><label className={LBL}>Endereco</label><input className={INP} value={f.logradouro} onChange={(e) => s('logradouro', e.target.value)} /></div>
                <div><label className={LBL}>Numero</label><input className={INP} value={f.numeroEndereco} onChange={(e) => s('numeroEndereco', e.target.value)} /></div>
                <div><label className={LBL}>Complemento</label><input className={INP} value={f.complemento} onChange={(e) => s('complemento', e.target.value)} /></div>
                <div><label className={LBL}>CEP</label><input className={INP} inputMode="numeric" placeholder="00000-000" value={f.cep} onChange={(e) => s('cep', fmtCep(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1.5fr_0.5fr_1fr]">
                <div><label className={LBL}>Bairro</label><input className={INP} value={f.bairro} onChange={(e) => s('bairro', e.target.value)} /></div>
                <div><label className={LBL}>Cidade</label><input className={INP} value={f.cidade} onChange={(e) => s('cidade', e.target.value)} /></div>
                <div><label className={LBL}>UF</label><input className={`${INP} text-center`} maxLength={2} value={f.uf} onChange={(e) => s('uf', e.target.value.toUpperCase())} /></div>
                <div><label className={LBL}>Fone(s)</label><input className={INP} inputMode="tel" placeholder="(00) 00000-0000" value={f.telefone} onChange={(e) => s('telefone', fmtFone(e.target.value))} /></div>
              </div>
              <p className="text-[12px] text-slate-400">Inscricoes Estaduais, NIRE, Insc. Municipal e Website ficam disponiveis na ficha apos salvar.</p>
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">Esta secao fica disponivel <b>depois de salvar</b> a empresa. Preencha o cadastro acima e clique em <b>Salvar</b> — voce cai na ficha completa com todas as secoes liberadas.</p>
          )}
        </div>
      )}
    </div>
  );
}
