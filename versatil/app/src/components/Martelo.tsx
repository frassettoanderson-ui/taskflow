export function Martelo({ className = "", animado = false }: { className?: string; animado?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="currentColor" aria-hidden>
      <g className={animado ? "martelo-anim" : ""}>
        <g transform="translate(56 50) rotate(-45)">
          <rect x="-34" y="-20" width="11" height="40" rx="3" />
          <rect x="-20" y="-17" width="40" height="34" rx="2" />
          <rect x="23" y="-20" width="11" height="40" rx="3" />
          <rect x="-5.5" y="17" width="11" height="62" rx="4.5" />
        </g>
      </g>
      <rect x="22" y="103" width="52" height="11" rx="5.5" />
    </svg>
  );
}
