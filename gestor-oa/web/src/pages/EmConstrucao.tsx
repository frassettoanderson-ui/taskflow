import { Construction } from 'lucide-react';

// Placeholder para telas cujo caminho ja existe no menu mas serao construidas depois.
export default function EmConstrucao({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">{titulo}</h1>
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <Construction size={48} className="text-marca-400" />
        <div className="text-lg font-medium text-slate-700">Em construcao</div>
        <p className="max-w-md text-sm text-slate-500">
          {descricao ?? 'Esta tela ja esta no menu e sera implementada em breve.'}
        </p>
      </div>
    </div>
  );
}
