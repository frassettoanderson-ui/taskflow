import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SquarePen, Heart, Save, RotateCcw } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Spinner, useToast } from '../../components/ui';
import type { ProtocoloFisico, StatusProtocoloFisico, EmpresaLista } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-2 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 block text-[13px] font-semibold text-slate-700';

const STATUS: { v: StatusProtocoloFisico; l: string }[] = [
  { v: 'PENDENTE', l: 'Pendente' },
  { v: 'IMPRESSO', l: 'Impresso' },
  { v: 'ENTREGUE', l: 'Entregue' },
  { v: 'CANCELADO', l: 'Cancelado' },
];

const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function ProtocoloFisicoForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const toast = useToast();

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [empresas, setEmpresas] = useState<EmpresaLista[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [numero, setNumero] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusProtocoloFisico>('PENDENTE');
  const [data, setData] = useState(hojeISO());

  useEffect(() => {
    api.get<{ items: EmpresaLista[] }>('/empresas?limit=500').then((p) => setEmpresas(p.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (novo) return;
    api.get<ProtocoloFisico>(`/protocolos-fisicos/${id}`).then((p) => {
      setEmpresaId(p.empresaId ?? '');
      setTitulo(p.titulo ?? p.descricao ?? '');
      setNumero(p.numero);
      setStatus(p.status);
      setData((p.data ?? '').slice(0, 10) || hojeISO());
    }).catch(() => toast('erro', 'Protocolo nao encontrado.')).finally(() => setCarregando(false));
  }, [id, novo]);

  async function salvar() {
    if (!empresaId) return toast('erro', 'Selecione a empresa.');
    if (titulo.trim().length < 1) return toast('erro', 'Informe o titulo.');
    setSalvando(true);
    try {
      const body = { empresaId, titulo, status, data };
      if (novo) await api.post('/protocolos-fisicos', body);
      else await api.put(`/protocolos-fisicos/${id}`, body);
      toast('ok', 'Protocolo salvo.');
      navigate('/documentos/protocolos-fisicos');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-fundo p-5 text-[13px]">
      <div className="mb-4 flex items-center gap-2 text-slate-600">
        <SquarePen size={16} className="text-slate-400" />
        <span className="text-marca-600 hover:underline cursor-pointer" onClick={() => navigate('/entregas')}>Lista de Entregas</span>
        <span className="text-slate-400">&rsaquo;</span>
        <span className="font-medium text-slate-700">Gestao de protocolos fisicos</span>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        {/* Empresa */}
        <div>
          <label className={`${LBL} flex items-center gap-1.5`}>Empresa <Heart size={13} className="text-marca-400" /></label>
          <select className={INP} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">Empresa</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className={LBL}>Status</label>
          <select className={INP} value={status} onChange={(e) => setStatus(e.target.value as StatusProtocoloFisico)}>
            {STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>

        {/* Titulo + ID */}
        <div>
          <div className="flex items-end justify-between">
            <label className={LBL}>Titulo</label>
            <span className="mb-1 text-[12px] font-medium text-marca-600">ID: {numero ?? '000'}</span>
          </div>
          <input className={INP} placeholder="Titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>

        {/* Data do protocolo + acoes */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={LBL}>Data do protocolo</label>
            <input type="date" className={`${INP} text-center`} value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
            <Save size={15} /> {salvando ? '...' : 'Salvar'}
          </button>
          <button onClick={() => navigate('/documentos/protocolos-fisicos')} className="flex items-center gap-2 rounded bg-status-warn px-5 py-2 text-[13px] font-medium text-white hover:bg-amber-500">
            <RotateCcw size={15} /> Voltar
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-dashed border-slate-300" />
    </div>
  );
}
