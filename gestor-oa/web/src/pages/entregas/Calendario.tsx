import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export default function Calendario() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [dias, setDias] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ dias: { dia: number; total: number }[] }>(`/entregas/calendario?ano=${ano}&mes=${mes}`)
      .then((r) => { const m: Record<number, number> = {}; r.dias.forEach((d) => (m[d.dia] = d.total)); setDias(m); })
      .finally(() => setLoading(false));
  }, [ano, mes]);

  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDias = new Date(ano, mes, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  function navegar(delta: number) {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; }
    setMes(m); setAno(a);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Calendario de Entregas</h1>
        <div className="flex items-center gap-3">
          <button className="btn-ghost border border-slate-300" onClick={() => navegar(-1)}>‹</button>
          <span className="min-w-[160px] text-center font-medium text-slate-700">{MESES[mes - 1]} {ano}</span>
          <button className="btn-ghost border border-slate-300" onClick={() => navegar(1)}>›</button>
          <button className="btn-ghost" onClick={() => navigate('/entregas')}>Ver lista</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="card p-4">
          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-400">
            {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {celulas.map((dia, i) => (
              <div key={i} className={`min-h-[80px] rounded-md border p-2 ${dia ? 'border-slate-200' : 'border-transparent'}`}>
                {dia && (
                  <>
                    <div className="text-xs text-slate-400">{dia}</div>
                    {dias[dia] ? (
                      <button
                        onClick={() => navigate('/entregas')}
                        className="mt-1 w-full rounded bg-marca-50 py-1 text-center text-sm font-semibold text-marca-700 hover:bg-marca-100"
                      >
                        {dias[dia]} entrega(s)
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
