import type { Obrigacao } from '../../lib/tipos';

// Lista de obrigacoes agrupadas por departamento, com checkboxes.
export function SeletorObrigacoes({
  obrigacoes,
  selecionados,
  onToggle,
}: {
  obrigacoes: Obrigacao[];
  selecionados: Set<string>;
  onToggle: (id: string) => void;
}) {
  const grupos = new Map<string, { nome: string; cor: string; itens: Obrigacao[] }>();
  for (const o of obrigacoes) {
    const dep = o.departamento;
    const key = dep?.id ?? 'sem';
    if (!grupos.has(key)) grupos.set(key, { nome: dep?.nome ?? 'Sem departamento', cor: dep?.cor ?? '#94a3b8', itens: [] });
    grupos.get(key)!.itens.push(o);
  }

  return (
    <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
      {[...grupos.values()].map((g) => (
        <div key={g.nome}>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium" style={{ color: g.cor }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: g.cor }} />
            {g.nome}
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {g.itens.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={selecionados.has(o.id)} onChange={() => onToggle(o.id)} />
                {o.nome}
              </label>
            ))}
          </div>
        </div>
      ))}
      {obrigacoes.length === 0 && <p className="text-sm text-slate-400">Cadastre obrigacoes no catalogo primeiro.</p>}
    </div>
  );
}
