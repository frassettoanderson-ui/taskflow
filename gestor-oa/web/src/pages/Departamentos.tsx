import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, PlusCircle, Trash2, Network, Tags } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';
import { Spinner, useToast } from '../components/ui';
import type { Departamento } from '../lib/tipos';

export default function Departamentos() {
  const navigate = useNavigate();
  const toast = useToast();
  const { sessao } = useAuth();
  const podeDep = temPermissao(sessao, 'admin_escritorio');

  const [deps, setDeps] = useState<Departamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  function carregar() {
    api.get<Departamento[]>('/departamentos')
      .then(setDeps)
      .catch(() => setDeps([]))
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  async function excluir(d: Departamento) {
    if (!confirm(`Excluir o departamento "${d.nome}"?`)) return;
    try {
      await api.del(`/departamentos/${d.id}`);
      toast('ok', 'Departamento excluido.');
      carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao excluir.'); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-neutral-100 p-5 text-[13px]">
      {/* Cabecalho */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Network size={16} className="text-slate-400" />
          <span>Sistema</span>
          <span className="text-slate-300">›</span>
          <span className="text-slate-700">Gestao de departamentos da empresa</span>
        </div>
        <div className="relative">
          <input className="w-56 rounded border border-slate-300 bg-white py-1 pl-7 pr-2 text-[12px] outline-none focus:border-marca-400" placeholder="Central de ajuda" disabled />
          <svg className="absolute left-2 top-1.5 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
              <th className="px-4 py-2.5">Departamento</th>
              <th className="px-4 py-2.5">Obrigacoes</th>
              <th className="px-4 py-2.5">Envio agendado</th>
              <th className="px-4 py-2.5 text-right">
                {podeDep && (
                  <button onClick={() => navigate('/cadastros/novo')} className="inline-flex items-center gap-1 font-medium text-marca-600 hover:text-marca-700">
                    <PlusCircle size={15} /> Novo
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deps.map((d) => (
              <tr key={d.id} className="group hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <button onClick={() => navigate(`/cadastros/${d.id}`)} className="flex items-center gap-2 text-marca-600 hover:underline">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.cor }} />
                    {d.nome}{!d.ativo && <span className="text-slate-400"> [inativo]</span>}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => navigate('/obrigacoes')} className="text-marca-600 hover:underline">
                    {d.obrigacoesCount ?? 0} obrigacoes
                  </button>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{d.envioAgendado}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-3">
                    {podeDep && (
                      <>
                        <button title="Novo sub-departamento" onClick={() => navigate(`/cadastros/novo?pai=${d.id}`)} className="text-status-ok hover:opacity-70">
                          <Plus size={16} />
                        </button>
                        <button title="Excluir" onClick={() => excluir(d)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {deps.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Nenhum departamento cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Etiquetas (nosso - tags das empresas, fora do Acessorias nessa tela) */}
      <button onClick={() => navigate('/cadastros/tags')} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-marca-600">
        <Tags size={14} /> Etiquetas (tags) das empresas »
      </button>
    </div>
  );
}
