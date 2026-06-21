import type { ReactNode } from 'react';

export interface Segmento {
  valor: number;
  cor: string;
  label: string;
}

// Donut em SVG (anel) com icone/centro. Se total = 0, mostra anel cinza.
export function Donut({
  segmentos,
  centro,
  tamanho = 150,
  espessura = 22,
}: {
  segmentos: Segmento[];
  centro?: ReactNode;
  tamanho?: number;
  espessura?: number;
}) {
  const raio = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * raio;
  const total = segmentos.reduce((s, x) => s + x.valor, 0);

  let acumulado = 0;
  const arcos = total
    ? segmentos
        .filter((s) => s.valor > 0)
        .map((s) => {
          const frac = s.valor / total;
          const dash = frac * circ;
          const offset = -acumulado;
          acumulado += dash;
          return { ...s, dash, gap: circ - dash, offset, pct: Math.round(frac * 100) };
        })
    : [];

  return (
    <div className="relative inline-grid place-items-center" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90">
        {/* trilho de fundo */}
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={espessura}
        />
        {arcos.map((a, i) => (
          <circle
            key={i}
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            stroke={a.cor}
            strokeWidth={espessura}
            strokeDasharray={`${a.dash} ${a.gap}`}
            strokeDashoffset={a.offset}
            style={{ cursor: 'pointer' }}
          >
            <title>{`${a.valor}/${a.pct}% ${a.label}`}</title>
          </circle>
        ))}
      </svg>
      <div className="absolute grid place-items-center text-slate-300">{centro}</div>
    </div>
  );
}
