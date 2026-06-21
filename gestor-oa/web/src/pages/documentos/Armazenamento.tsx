import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';
import { formatarBytes } from '../../lib/tipos';

interface Painel {
  porEmpresa: { empresaId: string; razaoSocial: string; bytes: number; arquivos: number }[];
  totalBytes: number;
  limiteMB: number | null;
}

export default function Armazenamento() {
  const [painel, setPainel] = useState<Painel | null>(null);
  useEffect(() => { api.get<Painel>('/ged/armazenamento').then(setPainel); }, []);
  if (!painel) return <Spinner />;

  const limiteBytes = painel.limiteMB ? painel.limiteMB * 1024 * 1024 : null;
  const pct = limiteBytes ? Math.min(100, Math.round((painel.totalBytes / limiteBytes) * 100)) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Armazenamento (GED)</h1>

      <div className="card p-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-slate-500">Total utilizado</div>
            <div className="text-3xl font-bold text-marca-600">{formatarBytes(painel.totalBytes)}</div>
          </div>
          {painel.limiteMB && <div className="text-sm text-slate-500">Limite: {painel.limiteMB} MB</div>}
        </div>
        {pct !== null && (
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className={`h-full ${pct > 90 ? 'bg-status-danger' : 'bg-marca-500'}`} style={{ width: `${pct}%` }} />
          </div>
        )}
        {!painel.limiteMB && <p className="mt-2 text-xs text-slate-400">Defina um limite em Configuracoes (config.limiteArmazenamentoMB).</p>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Arquivos</th><th className="px-3 py-2">Espaco</th></tr>
          </thead>
          <tbody>
            {painel.porEmpresa.map((e) => (
              <tr key={e.empresaId} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-700">{e.razaoSocial}</td>
                <td className="px-3 py-2 text-slate-500">{e.arquivos}</td>
                <td className="px-3 py-2 text-slate-600">{formatarBytes(e.bytes)}</td>
              </tr>
            ))}
            {painel.porEmpresa.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Nenhum documento armazenado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
