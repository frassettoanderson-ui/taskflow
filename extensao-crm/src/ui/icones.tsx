// Ícones em SVG (traço 1.6, 20x20). Nada de emoji/glifo como ícone.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { tam?: number };

function Base({ tam = 18, children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

export const IconFunil = (p: P) => (
  <Base {...p}>
    <path d="M3 4h14l-5.2 6.4V16l-3.6-1.6v-4z" />
  </Base>
);
export const IconQuadro = (p: P) => (
  <Base {...p}>
    <rect x="2.8" y="3.5" width="4" height="13" rx="1" />
    <rect x="8" y="3.5" width="4" height="9" rx="1" />
    <rect x="13.2" y="3.5" width="4" height="6" rx="1" />
  </Base>
);
export const IconRaio = (p: P) => (
  <Base {...p}>
    <path d="M11 2.5 4.5 11h5l-1 6.5L15.5 9h-5z" />
  </Base>
);
export const IconRelogio = (p: P) => (
  <Base {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v4l2.6 1.6" />
  </Base>
);
export const IconSino = (p: P) => (
  <Base {...p}>
    <path d="M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.3 1.5H4.2z" />
    <path d="M8.3 17a1.8 1.8 0 0 0 3.4 0" />
  </Base>
);
export const IconFicha = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="2.8" width="13" height="14.4" rx="1.6" />
    <circle cx="10" cy="8" r="2.3" />
    <path d="M6.3 14c.6-1.8 2-2.7 3.7-2.7s3.1.9 3.7 2.7" />
  </Base>
);
export const IconEngrenagem = (p: P) => (
  <Base {...p}>
    <circle cx="10" cy="10" r="2.4" />
    <path d="M10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" />
  </Base>
);
export const IconFechar = (p: P) => (
  <Base {...p}>
    <path d="m5 5 10 10M15 5 5 15" />
  </Base>
);
export const IconMais = (p: P) => (
  <Base {...p}>
    <path d="M10 4v12M4 10h12" />
  </Base>
);
export const IconLixo = (p: P) => (
  <Base {...p}>
    <path d="M4 5.5h12M8 5.5V4h4v1.5M5.5 5.5l.7 10.5h7.6l.7-10.5" />
  </Base>
);
export const IconLapis = (p: P) => (
  <Base {...p}>
    <path d="M12.8 3.8 16.2 7.2 7.5 15.9 3.6 16.4 4.1 12.5z" />
  </Base>
);
export const IconEnviar = (p: P) => (
  <Base {...p}>
    <path d="M3.5 10 16.5 3.5 13 16.5l-3-5.2z" />
    <path d="M10 11.3 16.5 3.5" />
  </Base>
);
export const IconInserir = (p: P) => (
  <Base {...p}>
    <path d="M4 15.5h12M10 3.5v8.5M6.5 8.5 10 12l3.5-3.5" />
  </Base>
);
export const IconBusca = (p: P) => (
  <Base {...p}>
    <circle cx="8.8" cy="8.8" r="5.3" />
    <path d="m12.8 12.8 3.7 3.7" />
  </Base>
);
export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Base>
);
export const IconImagem = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <circle cx="7.5" cy="8" r="1.4" />
    <path d="m3.5 14.5 4.2-4 3 2.8 2.3-2 3.5 3.2" />
  </Base>
);
export const IconMicrofone = (p: P) => (
  <Base {...p}>
    <rect x="7.5" y="2.8" width="5" height="9" rx="2.5" />
    <path d="M4.8 9.5a5.2 5.2 0 0 0 10.4 0M10 14.7v2.5" />
  </Base>
);
export const IconDocumento = (p: P) => (
  <Base {...p}>
    <path d="M5 2.8h6.5L15 6.3v10.9H5z" />
    <path d="M11.3 2.8v3.7H15M7.5 10.5h5M7.5 13.3h5" />
  </Base>
);
export const IconVideo = (p: P) => (
  <Base {...p}>
    <rect x="2.8" y="5" width="10" height="10" rx="1.5" />
    <path d="m12.8 8.6 4.4-2.4v7.6l-4.4-2.4" />
  </Base>
);
export const IconArrastar = (p: P) => (
  <Base {...p}>
    <path d="M7.5 5h.01M12.5 5h.01M7.5 10h.01M12.5 10h.01M7.5 15h.01M12.5 15h.01" strokeWidth={2.6} />
  </Base>
);
export const IconSeta = (p: P) => (
  <Base {...p}>
    <path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5" />
  </Base>
);
export const IconBaixar = (p: P) => (
  <Base {...p}>
    <path d="M10 3.5v9M6.3 9 10 12.7 13.7 9M4 16.5h12" />
  </Base>
);
export const IconFaisca = (p: P) => (
  <Base {...p}>
    <path d="M10 2.8 11.6 8.4 17.2 10l-5.6 1.6L10 17.2l-1.6-5.6L2.8 10l5.6-1.6z" />
  </Base>
);
export const IconOlho =({ fechado, ...p }: P & { fechado?: boolean }) => (
  <Base {...p}>
    <path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z" />
    <circle cx="10" cy="10" r="2.2" />
    {fechado && <path d="M4 16 16 4" />}
  </Base>
);
export const IconSubir =(p: P) => (
  <Base {...p}>
    <path d="M10 13V4M6.3 7.5 10 3.8l3.7 3.7M4 16.5h12" />
  </Base>
);
