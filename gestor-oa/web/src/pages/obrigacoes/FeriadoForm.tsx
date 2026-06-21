import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Settings, Save, Plus, RotateCcw, Trash2, Search } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { Feriado } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 block text-[13px] font-bold text-slate-700';

export default function FeriadoForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const { sessao } = useAuth();
  const pode = temPermissao(sessao, 'obrigacoes_gerenciar');

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [data, setData] = useState('');
  const [nome, setNome] = useState('');
  const [abrangencia, setAbrangencia] = useState<'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL'>('NACIONAL');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');

  useEffect(() => {
    if (novo) return;
    api.get<Feriado>(`/feriados/${id}`).then((f) => {
      setData(f.data.slice(0, 10));
      setNome(f.nome);
      setAbrangencia((f.abrangencia as 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL') ?? 'NACIONAL');
      setUf(f.uf ?? '');
      setMunicipio(f.municipio ?? '');
    }).catch(() => toast('erro', 'Feriado nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  async function salvar() {
    if (!data) return toast('erro', 'Informe a data do feriado.');
    if (nome.trim().length < 2) return toast('erro', 'Informe a descricao do feriado.');
    setSalvando(true);
    try {
      const payload = { data, nome, abrangencia, uf: abrangencia === 'ESTADUAL' ? uf : null, municipio: abrangencia === 'MUNICIPAL' ? municipio : null };
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
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Settings size={16} className="text-slate-400" />
          <span>Sistema</span><span className="text-slate-300">&rsaquo;</span>
          <span>Feriados</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-700">{novo ? 'Novo feriado' : 'Cadastro de feriado'}</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* Linha principal */}
      <div className="grid grid-cols-1 items-end gap-x-5 gap-y-3 md:grid-cols-[200px_1fr_200px_auto]">
        <div>
          <label className={LBL}>Data do feriado</label>
          <input type="date" className={INP} value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <label className={LBL}>Descricao</label>
          <input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Descricao do feriado" />
        </div>
        <div>
          <label className={LBL}>Abrangencia</label>
          <select className={INP} value={abrangencia} onChange={(e) => setAbrangencia(e.target.value as 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL')}>
            <option value="NACIONAL">Nacional/Geral</option>
            <option value="ESTADUAL">Estadual</option>
            <option value="MUNICIPAL">Municipal</option>
          </select>
        </div>
        <div className="flex gap-2">
          {pode && <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? '...' : 'Salvar'}</button>}
          {pode && <button onClick={() => navigate('/obrigacoes/feriados/novo')} className="flex items-center gap-2 rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo</button>}
          <button onClick={() => navigate('/obrigacoes/feriados')} className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>

      {/* Campos condicionais por abrangencia */}
      {abrangencia === 'ESTADUAL' && (
        <div className="mt-3 max-w-[200px]">
          <label className={LBL}>UF</label>
          <input className={INP} maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} placeholder="UF" />
        </div>
      )}
      {abrangencia === 'MUNICIPAL' && (
        <div className="mt-3 max-w-[360px]">
          <label className={LBL}>Municipio</label>
          <input className={INP} value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Nome do municipio" />
        </div>
      )}

      {!novo && pode && (
        <div className="mt-6">
          <button onClick={excluir} className="flex items-center gap-2 rounded bg-status-danger px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600"><Trash2 size={15} /> Excluir feriado</button>
        </div>
      )}
    </div>
  );
}
