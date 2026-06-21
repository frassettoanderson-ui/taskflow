import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Search, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner } from '../../components/ui';
import type { Feriado } from '../../lib/tipos';

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const POR_PAGINA = 15;

function dataLonga(s: string) {
  const d = new Date(s);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
function abrangenciaLabel(f: Feriado) {
  if (f.abrangencia === 'NACIONAL') return 'Nacional/Geral';
  if (f.abrangencia === 'ESTADUAL') return f.uf || 'Estadual';
  return f.municipio || 'Municipal';
}

export default function Feriados() {
  const { sessao } = useAuth();
  const navigate = useNavigate();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => { api.get<Feriado[]>('/feriados').then(setFeriados).catch(() => setFeriados([])).finally(() => setLoading(false)); }, []);

  if (loading) return <Spinner />;

  const termo = busca.trim().toLowerCase();
  const lista = feriados.filter((f) => !termo || f.nome.toLowerCase().includes(termo));
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const pag = Math.min(pagina, totalPaginas);
  const visiveis = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* breadcrumb */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Settings size={16} className="text-slate-400" />
          <span>Sistema</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-700">Feriados para calculo dos dias uteis</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-400" />
          <input className="w-full rounded border border-marca-300 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-marca-500" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Filtrar pelo nome [Enter para filtrar]" />
        </div>
        <div className="flex-1 text-center text-[13px] font-medium text-marca-600">Listando {lista.length} registros - pagina {pag} de {totalPaginas}:</div>
        {podeGerenciar && (
          <button onClick={() => navigate('/obrigacoes/feriados/novo')} className="flex items-center gap-2 rounded bg-marca-500 px-5 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo feriado</button>
        )}
      </div>

      {/* Tabela */}
      <div className="mt-3 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[12px] font-bold text-slate-600">
              <th className="px-4 py-2.5">Data do feriado</th>
              <th className="px-4 py-2.5">Descricao</th>
              <th className="px-4 py-2.5">Abrangencia</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((f) => (
              <tr key={f.id} className="cursor-pointer border-b border-slate-200 odd:bg-white even:bg-fundo hover:bg-caixa" onClick={() => navigate(`/obrigacoes/feriados/${f.id}`)}>
                <td className="px-4 py-2.5"><span className="font-medium text-marca-600">{dataLonga(f.data)}</span></td>
                <td className="px-4 py-2.5 text-slate-700">{f.nome}</td>
                <td className="px-4 py-2.5 text-slate-600">{abrangenciaLabel(f)}</td>
              </tr>
            ))}
            {visiveis.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-400">Nenhum feriado.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Paginacao */}
      {totalPaginas > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-[13px]">
          <button disabled={pag <= 1} onClick={() => setPagina(pag - 1)} className="rounded border border-slate-300 bg-white px-3 py-1 text-marca-600 disabled:opacity-40">Anterior</button>
          <span className="text-slate-500">{pag} / {totalPaginas}</span>
          <button disabled={pag >= totalPaginas} onClick={() => setPagina(pag + 1)} className="rounded border border-slate-300 bg-white px-3 py-1 text-marca-600 disabled:opacity-40">Proxima</button>
        </div>
      )}
    </div>
  );
}
