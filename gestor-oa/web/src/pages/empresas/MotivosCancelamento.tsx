import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner } from '../../components/ui';
import type { MotivoCancelamento } from '../../lib/tipos';

export default function MotivosCancelamento() {
  const navigate = useNavigate();
  const { sessao } = useAuth();
  const pode = temPermissao(sessao, 'empresas_editar');
  const [itens, setItens] = useState<MotivoCancelamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<MotivoCancelamento[]>('/motivos-cancelamento').then(setItens).catch(() => setItens([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-fundo p-5 text-[13px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <XCircle size={16} className="text-slate-400" /><span>Empresas</span>
          <span className="text-slate-300">›</span><span className="text-slate-700">Motivos de cancelamento das empresas</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
              <th className="px-4 py-2.5">Motivo</th>
              <th className="px-4 py-2.5">Ativo?</th>
              <th className="px-4 py-2.5">Empresas</th>
              <th className="px-4 py-2.5 text-right">
                {pode && <button onClick={() => navigate('/empresas/motivos/novo')} className="inline-flex items-center gap-1 font-medium text-marca-600 hover:text-marca-700"><Plus size={15} /> Novo motivo</button>}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5"><button onClick={() => navigate(`/empresas/motivos/${m.id}`)} className="text-marca-600 hover:underline">{m.nome}</button></td>
                <td className="px-4 py-2.5 text-slate-600">{m.ativo ? 'Sim' : 'Nao'}</td>
                <td className="px-4 py-2.5"><button onClick={() => navigate(`/empresas?motivo=${m.id}`)} className="text-marca-600 hover:underline">{m.empresasCount} empresa{m.empresasCount === 1 ? '' : 's'}</button></td>
                <td className="px-4 py-2.5"></td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Nenhum motivo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
