type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconeSacola = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M5 7h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" /></svg>
);
export const IconeImagem = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 9" /></svg>
);
export const IconeCheck = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.5 2.5L16 9.5" /></svg>
);
export const IconePix = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="m12 3 9 9-9 9-9-9 9-9Z" /><path d="m8.5 8.5 7 7M15.5 8.5l-7 7" /></svg>
);
export const IconeLoja = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 10v10h16V10M3 10l2-6h14l2 6H3Z" /><path d="M10 20v-5h4v5" /></svg>
);
export const IconeEscudo = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconeWhats = ({ className = "" }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg>
);
