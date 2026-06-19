import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Settings, Heart, Save, RotateCcw } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../components/ui';
import type { Matriz, EmpresaLista, UsuarioBasico, Departamento } from '../../lib/tipos';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-2 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-1 block text-[13px] font-semibold text-slate-700';

const hojeBR = () => { const h = new Date(); return `${String(h.getDate()).padStart(2, '0')}/${String(h.getMonth() + 1).padStart(2, '0')}/${String(h.getFullYear()).slice(2)}`; };

export default function ProcessoForm() {
  const navigate = useNavigate();
  const toast = useToast();

  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLista[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);

  const [matrizId, setMatrizId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [gestorId, setGestorId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get<Matriz[]>('/matrizes').then(setMatrizes).catch(() => undefined);
    api.get<{ items: EmpresaLista[] }>('/empresas?limit=500').then((p) => setEmpresas(p.items)).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
  }, []);

  const matriz = useMemo(() => matrizes.find((m) => m.id === matrizId), [matrizes, matrizId]);
  const deptoNome = useMemo(() => {
    if (!matriz?.departamentoId) return 'Indefinido na matriz';
    return departamentos.find((x) => x.id === matriz.departamentoId)?.nome ?? 'Indefinido na matriz';
  }, [matriz, departamentos]);

  async function salvar() {
    if (!matrizId) return toast('erro', 'Selecione o processo (matriz).');
    if (!empresaId) return toast('erro', 'Selecione a empresa.');
    setSalvando(true);
    try {
      const p = await api.post<{ id: string }>('/processos/iniciar', {
        matrizId, empresaId, titulo: titulo.trim() || undefined, gestorId: gestorId || undefined, observacoes: observacoes.trim() || undefined,
      });
      toast('ok', 'Processo iniciado.');
      navigate(`/processos/${p.id}`);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="-m-6 min-h-full bg-slate-100 p-5 text-[13px]">
      <div className="mb-5 flex items-center gap-2 text-slate-600">
        <CheckCircle2 size={16} className="text-slate-400" />
        <span className="font-medium text-slate-700">Gestao de processos</span>
        <span className="text-slate-400">[F10]</span>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        {/* Processo (matriz) + Inicio */}
        <div>
          <label className={`${LBL} flex items-center gap-1.5`}>Processo <Settings size={13} className="text-marca-400" /></label>
          <select className={INP} value={matrizId} onChange={(e) => setMatrizId(e.target.value)}>
            <option value="">Selecione...</option>
            {matrizes.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={`${LBL} flex items-center gap-1.5`}>Empresa <Heart size={13} className="text-marca-400" /></label>
            <span className="mb-1 text-[12px] font-medium text-marca-600">Inicio: {hojeBR()}</span>
          </div>
          <select className={INP} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">Empresa</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
          </select>
        </div>

        {/* Titulo + Dpto + Gestor */}
        <div>
          <label className={LBL}>Titulo do processo</label>
          <input className={INP} placeholder="Titulo do processo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
          <div className="flex items-center text-[12px] text-slate-500">
            <span className="font-semibold text-slate-600">Dpto:</span>&nbsp;<span className="text-marca-600">{deptoNome}</span>
          </div>
          <div>
            <label className={LBL}>Gestor desse processo</label>
            <select className={INP} value={gestorId} onChange={(e) => setGestorId(e.target.value)}>
              <option value="">Selecione...</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Observacoes + Status/acoes */}
        <div>
          <label className={LBL}>Observacoes</label>
          <textarea className={INP} rows={2} placeholder="Observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>
        <div className="flex flex-col justify-end">
          <div className="mb-1 text-[12px]"><span className="font-semibold text-marca-600">Status:</span> <span className="text-slate-600">Iniciando</span></div>
          <div className="flex gap-3">
            <button onClick={salvar} disabled={salvando} className="flex flex-1 items-center justify-center gap-2 rounded bg-status-ok px-5 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
              <Save size={15} /> {salvando ? '...' : 'Salvar'}
            </button>
            <button onClick={() => navigate('/processos')} className="flex flex-1 items-center justify-center gap-2 rounded bg-status-warn px-5 py-2 text-[13px] font-medium text-white hover:bg-amber-500">
              <RotateCcw size={15} /> Voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
