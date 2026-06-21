import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { XCircle, Save, Plus, RotateCcw } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Spinner, useToast } from '../../components/ui';
import type { MotivoCancelamento } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 block text-[12px] font-medium text-slate-600';

export default function MotivoForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (novo) return;
    api.get<MotivoCancelamento>(`/motivos-cancelamento/${id}`).then((m) => { setNome(m.nome); setAtivo(m.ativo); })
      .catch(() => toast('erro', 'Motivo nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome do motivo.');
    setSalvando(true);
    try {
      if (novo) await api.post('/motivos-cancelamento', { nome, ativo });
      else await api.put(`/motivos-cancelamento/${id}`, { nome, ativo });
      toast('ok', 'Motivo salvo.');
      navigate('/empresas/motivos');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-fundo p-5 text-[13px]">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <XCircle size={16} className="text-slate-400" /><span>Empresas</span>
        <span className="text-slate-300">›</span><span className="text-slate-700">Motivos de cancelamento das empresas</span>
      </div>

      <div className="grid grid-cols-1 items-end gap-x-5 gap-y-3 md:grid-cols-[1fr_220px_auto]">
        <div><label className={LBL}>Nome do motivo</label><input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do motivo" /></div>
        <div><label className={LBL}>Ativo?</label><select className={INP} value={ativo ? 'sim' : 'nao'} onChange={(e) => setAtivo(e.target.value === 'sim')}><option value="sim">Sim</option><option value="nao">Nao</option></select></div>
        <div className="flex gap-2">
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-md bg-status-ok px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"><Save size={16} /> {salvando ? '...' : 'Salvar'}</button>
          <button onClick={() => { navigate('/empresas/motivos/novo'); setNome(''); setAtivo(true); }} className="flex items-center gap-2 rounded-md bg-marca-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo</button>
          <button onClick={() => navigate('/empresas/motivos')} className="flex items-center gap-2 rounded-md bg-status-warn px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"><RotateCcw size={16} /> Voltar</button>
        </div>
      </div>
    </div>
  );
}
