import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Layers, FileCheck, GitBranch, X } from 'lucide-react';
import { useToast } from './ui';

// Botao flutuante de acesso rapido (estilo Acessorias).
export default function FAB() {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const acoes = [
    { label: 'Alocar obrigacao em massa', icon: Layers, acao: () => navigate('/obrigacoes/alocacao') },
    { label: 'Nova empresa', icon: Building2, acao: () => navigate('/empresas/nova') },
    { label: 'Nova entrega avulsa', icon: FileCheck, acao: () => toast('ok', 'Entregas: Modulo 3') },
    { label: 'Novo processo', icon: GitBranch, acao: () => toast('ok', 'Processos: Modulo 6') },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {aberto &&
        acoes.map((a) => (
          <button
            key={a.label}
            onClick={() => { a.acao(); setAberto(false); }}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <a.icon size={16} className="text-marca-500" />
            {a.label}
          </button>
        ))}
      <button
        onClick={() => setAberto((v) => !v)}
        className="grid h-14 w-14 place-items-center rounded-full bg-marca-500 text-white shadow-xl transition hover:bg-marca-600"
        title="Acesso rapido"
      >
        {aberto ? <X size={24} /> : <Plus size={24} />}
      </button>
    </div>
  );
}
