import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';

interface Item { id: string; titulo: string; empresa: string; contatoNome: string; nota: number; comentario: string | null; data: string }
interface Dados { total: number; media: number; itens: Item[] }

export default function AvaliacoesSolicitacoes() {
  const [d, setD] = useState<Dados | null>(null);
  useEffect(() => { api.get<Dados>('/gestao-portal/avaliacoes-solicitacoes').then(setD).catch(() => setD({ total: 0, media: 0, itens: [] })); }, []);
  if (!d) return <Spinner />;

  const estrelas = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800"><Star size={22} /> Avaliacao das Solicitacoes</h1>
        <p className="text-sm text-slate-500">Notas e comentarios que os clientes deram ao finalizar solicitacoes na Area VIP.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-3"><div className="text-xs text-slate-500">Avaliacoes</div><div className="mt-1 text-xl font-bold text-slate-700">{d.total}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-500">Media (1-5)</div><div className="mt-1 text-xl font-bold text-amber-500">{d.media.toFixed(1)} ★</div></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Nota</th><th className="px-3 py-2">Solicitacao</th><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2">Comentario</th><th className="px-3 py-2">Data</th></tr>
          </thead>
          <tbody>
            {d.itens.map((i) => (
              <tr key={i.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-amber-500">{estrelas(i.nota)}</td>
                <td className="px-3 py-2 text-slate-700">{i.titulo}</td>
                <td className="px-3 py-2 text-slate-500">{i.empresa}</td>
                <td className="px-3 py-2 text-slate-500">{i.contatoNome}</td>
                <td className="px-3 py-2 text-slate-500">{i.comentario ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400">{new Date(i.data).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
            {d.itens.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Nenhuma solicitacao avaliada ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
