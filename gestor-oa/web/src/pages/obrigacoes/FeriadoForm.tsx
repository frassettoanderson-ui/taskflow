import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Settings, Save, RotateCcw, Trash2, Search } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { Feriado } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-2 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const NUM = INP + ' text-center';
const LBL = 'mb-1 block text-[14px] font-bold text-slate-700';

export default function FeriadoForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const { sessao } = useAuth();
  const pode = temPermissao(sessao, 'obrigacoes_gerenciar');

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [dia, setDia] = useState(0);
  const [mes, setMes] = useState(0);
  const [ano, setAno] = useState(0);
  const [nome, setNome] = useState('');
  const [cidades, setCidades] = useState('');

  useEffect(() => {
    if (novo) return;
    api.get<Feriado>(`/feriados/${id}`).then((f) => {
      setDia(f.dia); setMes(f.mes); setAno(f.ano);
      setNome(f.nome); setCidades(f.cidades ?? '');
    }).catch(() => toast('erro', 'Feriado nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  async function salvar() {
    if (dia < 1 || dia > 31) return toast('erro', 'Informe um dia valido (1 a 31).');
    if (mes < 1 || mes > 12) return toast('erro', 'Informe um mes valido (1 a 12).');
    if (nome.trim().length < 2) return toast('erro', 'Informe a descricao do feriado.');
    setSalvando(true);
    try {
      const payload = { dia, mes, ano: ano || 0, nome, cidades: cidades.trim() || null };
      if (novo) await api.post('/feriados', payload);
      else await api.put(`/feriados/${id}`, payload);
      toast('ok', 'Feriado salvo.');
      navigate('/obrigacoes/feriados');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  async function excluir() {
    if (novo || !confirm('Remover este feriado?')) return;
    try { await api.del(`/feriados/${id}`); toast('ok', 'Feriado removido.'); navigate('/obrigacoes/feriados'); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao remover.'); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Settings size={16} className="text-slate-400" />
          <span>Sistema</span><span className="text-slate-300">&rsaquo;</span>
          <span>Feriados</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-700">Cadastro de Feriado</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* Linha 1: Escopo / Dia / Mes / Ano / Descricao */}
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-[150px_120px_120px_120px_1fr]">
        <div>
          <label className={LBL}>Escopo</label>
          <div className="py-2 text-[13px] text-slate-600">Local</div>
        </div>
        <div>
          <label className={LBL}>Dia</label>
          <input type="number" min={0} max={31} className={NUM} value={dia} onChange={(e) => setDia(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div>
          <label className={LBL}>Mes</label>
          <input type="number" min={0} max={12} className={NUM} value={mes} onChange={(e) => setMes(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div>
          <label className={LBL}>Ano</label>
          <input type="number" min={0} className={NUM} value={ano} onChange={(e) => setAno(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div>
          <label className={LBL}>Descricao</label>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Descricao" />
        </div>
      </div>

      {/* Linha 2: Cidades + botoes */}
      <div className="mt-3 grid grid-cols-1 items-end gap-x-5 gap-y-3 md:grid-cols-[1fr_auto]">
        <div>
          <label className={LBL}>Cidades que esse feriado tem validade (em branco = todas):</label>
          <input className={INP} value={cidades} onChange={(e) => setCidades(e.target.value)} placeholder="Em branco = Todas as cidades" />
        </div>
        <div className="flex gap-2">
          {pode && <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-6 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? '...' : 'Salvar'}</button>}
          <button onClick={() => navigate('/obrigacoes/feriados')} className="flex items-center gap-2 rounded-md bg-status-warn px-6 py-2 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      <p className="mt-2 text-[12px] text-slate-400">Ano = 0 indica um feriado recorrente (vale todo ano).</p>

      {!novo && pode && (
        <div className="mt-6">
          <button onClick={excluir} className="flex items-center gap-2 rounded bg-status-danger px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600"><Trash2 size={15} /> Excluir feriado</button>
        </div>
      )}
    </div>
  );
}
