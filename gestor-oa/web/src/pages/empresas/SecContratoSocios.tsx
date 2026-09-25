import { useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../components/ui';
import type { EmpresaDetalhe, Socio, Filial } from '../../lib/tipos';

// Seção "Contrato, imóveis e sócios" — dados que vieram do cadastro do ERP (Nauta/Atuan)
// e passam a viver aqui (cadastro único). Estilo denso, igual às demais seções da ficha.
const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 block text-[13px] font-bold text-slate-700';
const INTERESSES = ['Abrir minha empresa', 'Abrir MEI', 'Trocar de contador', 'Deixar de ser MEI', 'BPO Financeiro', 'Contabilidade Eleitoral', 'Outro'];
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'];

const fmtCpf = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 11); return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, (_m, a, b, c, e) => `${a}.${b}.${c}${e ? `-${e}` : ''}`); };
const fmtCnpj = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 14); return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, (_m, a, b, c, e, f) => `${a}.${b}.${c}/${e}${f ? `-${f}` : ''}`); };
const s = (v: unknown) => (v == null ? '' : String(v));
const socioVazio = (): Socio => ({ nomeCompleto: '', cpf: '', rg: '', nascimento: '', nomePai: '', nomeMae: '', participacao: '', estadoCivil: '', reciboIrpf: '', tituloEleitor: '', senhaGov: '', email: '', telefone: '' });

export default function SecContratoSocios({ empresa, podeEditar, onMudou }: { empresa: EmpresaDetalhe; podeEditar: boolean; onMudou: () => void }) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    diaVencimento: s(empresa.diaVencimento), primeiroVencimento: empresa.primeiroVencimento ? empresa.primeiroVencimento.slice(0, 10) : '',
    valorAbertura: s(empresa.valorAbertura), negociacaoObs: s(empresa.negociacaoObs), interesse: s(empresa.interesse), emAbertura: !!empresa.emAbertura,
    atividade: s(empresa.atividade), capitalSocial: s(empresa.capitalSocial), inscricaoImobiliaria: s(empresa.inscricaoImobiliaria),
    areaOcupada: s(empresa.areaOcupada), areaEdificacao: s(empresa.areaEdificacao), proprietarioNome: s(empresa.proprietarioNome),
    proprietarioCpf: s(empresa.proprietarioCpf), usaGlp: empresa.usaGlp == null ? '' : (empresa.usaGlp ? 'sim' : 'nao'),
  });
  const [socios, setSocios] = useState<Socio[]>(empresa.socios?.length ? empresa.socios.map((x) => ({ ...x, participacao: s(x.participacao) })) : []);
  const [filiais, setFiliais] = useState<Filial[]>(empresa.filiais ?? []);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const setSocio = (i: number, k: keyof Socio, v: string) => setSocios((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setFilial = (i: number, k: keyof Filial, v: string) => setFiliais((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const somaPart = socios.reduce((a, x) => a + (Number(x.participacao) || 0), 0);

  async function salvar() {
    if (socios.some((x) => x.nomeCompleto.trim().length < 2)) return toast('erro', 'Todo sócio precisa de nome.');
    if (somaPart > 100) return toast('erro', `A soma da participação é ${somaPart}% (máx. 100%).`);
    setSalvando(true);
    try {
      await api.put(`/empresas/${empresa.id}`, {
        diaVencimento: f.diaVencimento === '' ? null : Number(f.diaVencimento),
        primeiroVencimento: f.primeiroVencimento || null,
        valorAbertura: f.valorAbertura === '' ? null : Number(f.valorAbertura),
        negociacaoObs: f.negociacaoObs || null, interesse: f.interesse || null, emAbertura: f.emAbertura,
        atividade: f.atividade || null, capitalSocial: f.capitalSocial === '' ? null : Number(f.capitalSocial),
        inscricaoImobiliaria: f.inscricaoImobiliaria || null, areaOcupada: f.areaOcupada || null, areaEdificacao: f.areaEdificacao || null,
        proprietarioNome: f.proprietarioNome || null, proprietarioCpf: f.proprietarioCpf || null,
        usaGlp: f.usaGlp === '' ? null : f.usaGlp === 'sim',
        filiais: filiais.filter((x) => s(x.cnpj).trim() || s(x.fantasia).trim()),
        socios: socios.map((x) => ({ ...x, id: undefined, ordem: undefined, participacao: x.participacao === '' || x.participacao == null ? null : Number(x.participacao) })),
      });
      toast('ok', 'Contrato, imóveis e sócios salvos.');
      onMudou();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  const ro = !podeEditar;
  return (
    <div className="space-y-5">
      {/* Contrato / comercial */}
      <div>
        <p className="mb-2 text-[12px] font-semibold text-marca-600">Contrato e honorários</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_0.8fr_1fr_1fr_0.8fr]">
          <div><label className={LBL}>Tipo de contrato</label>
            <select className={INP} disabled={ro} value={f.interesse} onChange={(e) => set('interesse', e.target.value)}>
              <option value="">—</option>{INTERESSES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select></div>
          <div><label className={LBL}>Dia do vencimento</label><input className={INP} disabled={ro} type="number" min={1} max={31} value={f.diaVencimento} onChange={(e) => set('diaVencimento', e.target.value)} /></div>
          <div><label className={LBL}>1º vencimento</label><input className={INP} disabled={ro} type="date" value={f.primeiroVencimento} onChange={(e) => set('primeiroVencimento', e.target.value)} /></div>
          <div><label className={LBL}>Valor da abertura (R$)</label><input className={INP} disabled={ro} type="number" step="0.01" min={0} value={f.valorAbertura} onChange={(e) => set('valorAbertura', e.target.value)} /></div>
          <div><label className={LBL}>Em abertura?</label>
            <select className={INP} disabled={ro} value={f.emAbertura ? 'sim' : 'nao'} onChange={(e) => set('emAbertura', e.target.value === 'sim')}><option value="nao">Não</option><option value="sim">Sim</option></select></div>
        </div>
        <div className="mt-3"><label className={LBL}>Condições especiais negociadas (vão para o contrato)</label>
          <textarea className={`${INP} min-h-[90px]`} disabled={ro} value={f.negociacaoObs} onChange={(e) => set('negociacaoObs', e.target.value)} /></div>
      </div>

      {/* Imóvel / atividade */}
      <div>
        <p className="mb-2 text-[12px] font-semibold text-marca-600">Atividade, capital e imóvel</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_0.8fr]">
          <div><label className={LBL}>Atividade da empresa</label><input className={INP} disabled={ro} value={f.atividade} onChange={(e) => set('atividade', e.target.value)} /></div>
          <div><label className={LBL}>Capital social (R$)</label><input className={INP} disabled={ro} type="number" step="0.01" min={0} value={f.capitalSocial} onChange={(e) => set('capitalSocial', e.target.value)} /></div>
          <div><label className={LBL}>Inscrição imobiliária</label><input className={INP} disabled={ro} value={f.inscricaoImobiliaria} onChange={(e) => set('inscricaoImobiliaria', e.target.value)} /></div>
          <div><label className={LBL}>Usa gás GLP?</label>
            <select className={INP} disabled={ro} value={f.usaGlp} onChange={(e) => set('usaGlp', e.target.value)}><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></select></div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_2fr_1fr]">
          <div><label className={LBL}>Área ocupada (m²)</label><input className={INP} disabled={ro} value={f.areaOcupada} onChange={(e) => set('areaOcupada', e.target.value)} /></div>
          <div><label className={LBL}>Área da edificação (m²)</label><input className={INP} disabled={ro} value={f.areaEdificacao} onChange={(e) => set('areaEdificacao', e.target.value)} /></div>
          <div><label className={LBL}>Proprietário do imóvel</label><input className={INP} disabled={ro} value={f.proprietarioNome} onChange={(e) => set('proprietarioNome', e.target.value)} /></div>
          <div><label className={LBL}>CPF do proprietário</label><input className={INP} disabled={ro} value={f.proprietarioCpf} onChange={(e) => set('proprietarioCpf', fmtCpf(e.target.value))} /></div>
        </div>
      </div>

      {/* Sócios */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-marca-600">Quadro societário <span className="font-normal text-slate-500">(sócio 1 = titular/administrador) · participação: {somaPart}%</span></p>
          {!ro && <button onClick={() => setSocios((xs) => [...xs, socioVazio()])} className="flex items-center gap-1 rounded bg-marca-500 px-3 py-1 text-[12px] font-medium text-white hover:bg-marca-600"><Plus size={13} /> Sócio</button>}
        </div>
        {socios.length === 0 && <p className="text-[12px] text-slate-400">Nenhum sócio cadastrado.</p>}
        <div className="space-y-3">
          {socios.map((x, i) => (
            <div key={i} className="rounded border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-700">Sócio {i + 1}{i === 0 ? ' · titular' : ''}</span>
                {!ro && <button onClick={() => setSocios((xs) => xs.filter((_, j) => j !== i))} className="text-status-danger hover:text-red-700" title="Remover"><Trash2 size={14} /></button>}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_0.7fr]">
                <div><label className={LBL}>Nome completo</label><input className={INP} disabled={ro} value={s(x.nomeCompleto)} onChange={(e) => setSocio(i, 'nomeCompleto', e.target.value)} /></div>
                <div><label className={LBL}>CPF</label><input className={INP} disabled={ro} value={s(x.cpf)} onChange={(e) => setSocio(i, 'cpf', fmtCpf(e.target.value))} /></div>
                <div><label className={LBL}>RG</label><input className={INP} disabled={ro} value={s(x.rg)} onChange={(e) => setSocio(i, 'rg', e.target.value)} /></div>
                <div><label className={LBL}>Nascimento</label><input className={INP} disabled={ro} type="date" value={s(x.nascimento).slice(0, 10)} onChange={(e) => setSocio(i, 'nascimento', e.target.value)} /></div>
                <div><label className={LBL}>Partic. %</label><input className={INP} disabled={ro} type="number" min={0} max={100} value={s(x.participacao)} onChange={(e) => setSocio(i, 'participacao', e.target.value)} /></div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr]">
                <div><label className={LBL}>Nome do pai</label><input className={INP} disabled={ro} value={s(x.nomePai)} onChange={(e) => setSocio(i, 'nomePai', e.target.value)} /></div>
                <div><label className={LBL}>Nome da mãe</label><input className={INP} disabled={ro} value={s(x.nomeMae)} onChange={(e) => setSocio(i, 'nomeMae', e.target.value)} /></div>
                <div><label className={LBL}>Estado civil</label>
                  <select className={INP} disabled={ro} value={s(x.estadoCivil)} onChange={(e) => setSocio(i, 'estadoCivil', e.target.value)}><option value="">—</option>{ESTADO_CIVIL.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div><label className={LBL}>Recibo IRPF</label><input className={INP} disabled={ro} value={s(x.reciboIrpf)} onChange={(e) => setSocio(i, 'reciboIrpf', e.target.value)} /></div>
                <div><label className={LBL}>Título de eleitor</label><input className={INP} disabled={ro} value={s(x.tituloEleitor)} onChange={(e) => setSocio(i, 'tituloEleitor', e.target.value)} /></div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
                <div><label className={LBL}>E-mail</label><input className={INP} disabled={ro} value={s(x.email)} onChange={(e) => setSocio(i, 'email', e.target.value)} /></div>
                <div><label className={LBL}>Telefone</label><input className={INP} disabled={ro} value={s(x.telefone)} onChange={(e) => setSocio(i, 'telefone', e.target.value)} /></div>
                <div><label className={LBL}>Senha gov.br</label><input className={INP} disabled={ro} type="password" value={s(x.senhaGov)} onChange={(e) => setSocio(i, 'senhaGov', e.target.value)} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filiais */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-marca-600">Filiais</p>
          {!ro && <button onClick={() => setFiliais((xs) => [...xs, { cnpj: '', fantasia: '', municipio: '', estado: '', telefone: '' }])} className="flex items-center gap-1 rounded bg-marca-500 px-3 py-1 text-[12px] font-medium text-white hover:bg-marca-600"><Plus size={13} /> Filial</button>}
        </div>
        {filiais.length === 0 && <p className="text-[12px] text-slate-400">Sem filiais.</p>}
        <div className="space-y-2">
          {filiais.map((x, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[1.2fr_1.5fr_1.2fr_0.5fr_1fr_auto]">
              <input className={INP} disabled={ro} placeholder="CNPJ" value={s(x.cnpj)} onChange={(e) => setFilial(i, 'cnpj', fmtCnpj(e.target.value))} />
              <input className={INP} disabled={ro} placeholder="Nome fantasia" value={s(x.fantasia)} onChange={(e) => setFilial(i, 'fantasia', e.target.value)} />
              <input className={INP} disabled={ro} placeholder="Município" value={s(x.municipio)} onChange={(e) => setFilial(i, 'municipio', e.target.value)} />
              <input className={`${INP} text-center`} disabled={ro} placeholder="UF" maxLength={2} value={s(x.estado)} onChange={(e) => setFilial(i, 'estado', e.target.value.toUpperCase())} />
              <input className={INP} disabled={ro} placeholder="Telefone" value={s(x.telefone)} onChange={(e) => setFilial(i, 'telefone', e.target.value)} />
              {!ro && <button onClick={() => setFiliais((xs) => xs.filter((_, j) => j !== i))} className="text-status-danger hover:text-red-700" title="Remover"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      </div>

      {!ro && (
        <div className="flex items-center gap-3">
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? '...' : 'Salvar'}</button>
          {empresa.nautaClienteId && <span className="text-[11px] text-slate-400">Vinculado ao ERP — contrato, cobrança e comissões continuam sincronizados ao salvar.</span>}
        </div>
      )}
    </div>
  );
}
