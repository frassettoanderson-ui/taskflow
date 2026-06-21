import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { GrupoEmpresa } from '../../lib/tipos';

export default function GruposEmpresa() {
  const navigate = useNavigate();
  const { sessao } = useAuth();
  const toast = useToast();
  const pode = temPermissao(sessao, 'empresas_editar');
  const [itens, setItens] = useState<GrupoEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState('');

  function carregar() { api.get<GrupoEmpresa[]>('/grupos-empresa').then(setItens).catch(() => setItens([])).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  async function criar() {
    if (!novo.trim()) return;
    try { await api.post('/grupos-empresa', { nome: novo.trim() }); setNovo(''); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function renomear(g: GrupoEmpresa) {
    const nome = prompt('Novo nome do grupo:', g.nome);
    if (!nome?.trim()) return;
    try { await api.put(`/grupos-empresa/${g.id}`, { nome: nome.trim() }); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function excluir(g: GrupoEmpresa) {
    if (!confirm(`Excluir o grupo "${g.nome}"? As empresas ficarao sem grupo.`)) return;
    try { await api.del(`/grupos-empresa/${g.id}`); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-neutral-100 p-5 text-[13px]">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Users size={16} className="text-slate-400" />
        <span className="text-marca-600 hover:underline cursor-pointer" onClick={() => navigate('/empresas')}>Empresas</span>
        <span className="text-slate-300">›</span><span className="text-slate-700">Grupos de empresas</span>
      </div>

      {pode && (
        <div className="mb-3 flex gap-2">
          <input className="w-64 rounded border border-slate-300 bg-white px-2 py-1.5" placeholder="Nome do novo grupo" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && criar()} />
          <button onClick={criar} className="flex items-center gap-1 rounded bg-marca-500 px-4 py-1.5 font-medium text-white hover:bg-marca-600"><Plus size={15} /> Adicionar</button>
        </div>
      )}

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
            <th className="px-4 py-2.5">Grupo</th><th className="px-4 py-2.5">Empresas</th><th className="px-4 py-2.5 text-right"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-700">{g.nome}</td>
                <td className="px-4 py-2.5"><button onClick={() => navigate(`/empresas?grupo=${g.id}`)} className="text-marca-600 hover:underline">{g.empresasCount} empresa{g.empresasCount === 1 ? '' : 's'}</button></td>
                <td className="px-4 py-2.5 text-right">
                  {pode && <div className="flex justify-end gap-3">
                    <button onClick={() => renomear(g)} className="text-marca-600 hover:text-marca-700"><Pencil size={15} /></button>
                    <button onClick={() => excluir(g)} className="text-status-danger hover:opacity-70"><Trash2 size={15} /></button>
                  </div>}
                </td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-400">Nenhum grupo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
