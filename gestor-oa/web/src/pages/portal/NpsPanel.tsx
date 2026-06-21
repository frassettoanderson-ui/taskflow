import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';

interface Avaliacao { id: string; nota: number; comentario: string | null; contatoNome: string | null; contatoEmail: string; createdAt: string }
interface Nps {
  score: number; total: number; promotores: number; neutros: number; detratores: number; media: number;
  avaliacoes: Avaliacao[];
}

function corNota(n: number) { return n <= 6 ? '#d15b47' : n <= 8 ? '#ffb752' : '#88b87f'; }

export default function NpsPanel() {
  const [d, setD] = useState<Nps | null>(null);
  useEffect(() => { api.get<Nps>('/gestao-portal/nps').then(setD).catch(() => setD({ score: 0, total: 0, promotores: 0, neutros: 0, detratores: 0, media: 0, avaliacoes: [] })); }, []);
  if (!d) return <Spinner />;

  const pct = (n: number) => (d.total ? Math.round((n / d.total) * 100) : 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800"><Star size={22} /> Avaliacao NPS</h1>
        <p className="text-sm text-slate-500">Net Promoter Score com base nas avaliacoes dos clientes (0-10) na Area VIP.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card titulo="NPS" valor={String(d.score)} cor={d.score >= 50 ? 'text-emerald-600' : d.score >= 0 ? 'text-amber-600' : 'text-red-600'} sub="-100 a +100" />
        <Card titulo="Media" valor={d.media.toFixed(1)} cor="text-slate-700" />
        <Card titulo="Promotores (9-10)" valor={`${d.promotores} · ${pct(d.promotores)}%`} cor="text-emerald-600" />
        <Card titulo="Neutros (7-8)" valor={`${d.neutros} · ${pct(d.neutros)}%`} cor="text-amber-600" />
        <Card titulo="Detratores (0-6)" valor={`${d.detratores} · ${pct(d.detratores)}%`} cor="text-red-600" />
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 pt-4 text-sm font-semibold text-slate-700">Avaliacoes recebidas ({d.total})</div>
        <table className="mt-2 w-full text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Nota</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2">Comentario</th><th className="px-3 py-2">Data</th></tr>
          </thead>
          <tbody>
            {d.avaliacoes.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="px-3 py-2"><span className="inline-grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: corNota(a.nota) }}>{a.nota}</span></td>
                <td className="px-3 py-2 text-slate-600">{a.contatoNome ?? a.contatoEmail}</td>
                <td className="px-3 py-2 text-slate-500">{a.comentario ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400">{new Date(a.createdAt).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
            {d.avaliacoes.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-400">Nenhuma avaliacao recebida.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ titulo, valor, cor, sub }: { titulo: string; valor: string; cor: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{titulo}</div>
      <div className={`mt-1 text-xl font-bold ${cor}`}>{valor}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
