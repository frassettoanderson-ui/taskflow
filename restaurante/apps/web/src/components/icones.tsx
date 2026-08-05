/**
 * Os ícones do sistema.
 *
 * Por que SVG e não emoji: emoji muda de desenho em cada sistema operacional
 * (o 🍽️ do Windows não é o do iPhone), não aceita a cor da interface, não
 * alinha com o texto e o leitor de tela lê o nome do emoji em inglês. São
 * desenhos, não ícones.
 *
 * Estes são traçados em linha de 1.75px, um só estilo, herdando `currentColor`
 * — então mudam de cor junto com o texto ao redor.
 */

type Props = {
  /** tamanho em pixels (quadrado) */
  tamanho?: number;
  className?: string;
};

function Base({
  tamanho = 20,
  className,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ---------------- navegação ---------------- */

export const IconePedidos = (p: Props) => (
  <Base {...p}>
    <path d="M4 4h2l.6 3M7 12h10l3-6H6.6M7 12l-.4 2.5A1 1 0 0 0 7.6 16H18" />
    <circle cx="9" cy="19" r="1.4" />
    <circle cx="17" cy="19" r="1.4" />
  </Base>
);

export const IconeCozinha = (p: Props) => (
  <Base {...p}>
    <path d="M5 21h14M6 17h12l.7-6.5a4 4 0 0 0-2.9-4.3 3.6 3.6 0 0 0-6.6 0A4 4 0 0 0 5.3 10.5L6 17Z" />
    <path d="M9 13.5v0M12 13v0M15 13.5v0" />
  </Base>
);

export const IconeCaixa = (p: Props) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <path d="M2.5 10h19" />
    <path d="M6.5 14.5h3" />
  </Base>
);

export const IconeSalao = (p: Props) => (
  <Base {...p}>
    <path d="M6 3v7a2.5 2.5 0 0 0 5 0V3M8.5 10v11" />
    <path d="M17.5 3c-1.7 1.2-2.5 3-2.5 5.5s.8 3.5 2.5 3.5V21" />
  </Base>
);

export const IconeCardapio = (p: Props) => (
  <Base {...p}>
    <path d="M5 3.5h11a2 2 0 0 1 2 2V21l-3-1.8L12 21l-3-1.8L6 21V5.5a2 2 0 0 1 2-2Z" />
    <path d="M9 8h6M9 11.5h4" />
  </Base>
);

export const IconeClientes = (p: Props) => (
  <Base {...p}>
    <circle cx="9.5" cy="8" r="3.2" />
    <path d="M3.5 20a6 6 0 0 1 12 0" />
    <path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2M18 20a6 6 0 0 0-2.2-4.6" />
  </Base>
);

export const IconeMarketing = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5h2l6 4.5V6L7 10.5H5a1.5 1.5 0 0 0-1.5 1.5Z" />
    <path d="M17.5 9a4 4 0 0 1 0 6" />
    <path d="M20 6.5a7.5 7.5 0 0 1 0 11" />
  </Base>
);

export const IconeRelatorios = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 20.5h17" />
    <rect x="5" y="11" width="3.5" height="6.5" rx="1" />
    <rect x="10.5" y="6.5" width="3.5" height="11" rx="1" />
    <rect x="16" y="13.5" width="3.5" height="4" rx="1" />
  </Base>
);

export const IconeFinanceiro = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.2v9.6M14.4 9.4a2.6 2.6 0 0 0-2.4-1.3c-1.5 0-2.4.8-2.4 1.9 0 2.7 5 1.4 5 4.1 0 1.2-1 2-2.6 2a2.7 2.7 0 0 1-2.5-1.4" />
  </Base>
);

export const IconeEstoque = (p: Props) => (
  <Base {...p}>
    <path d="M20.5 8.2v7.6a1.6 1.6 0 0 1-.85 1.4l-6.9 3.6a1.6 1.6 0 0 1-1.5 0l-6.9-3.6a1.6 1.6 0 0 1-.85-1.4V8.2" />
    <path d="M3.5 8.2 12 3.6l8.5 4.6L12 12.8 3.5 8.2Z" />
    <path d="M12 12.8V21" />
  </Base>
);

export const IconeEntregas = (p: Props) => (
  <Base {...p}>
    <circle cx="5.5" cy="17.5" r="3" />
    <circle cx="18.5" cy="17.5" r="3" />
    <path d="M8.5 17.5h5.5l-2-8.5H9" />
    <path d="M14 9h3l1.5 8.5" />
  </Base>
);

/* ---------------- ações e estados ---------------- */

export const IconeMais = (p: Props) => (
  <Base {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Base>
);

export const IconeCadeadoAberto = (p: Props) => (
  <Base {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.6a4 4 0 0 1 7.7-1.5" />
  </Base>
);

export const IconeCadeadoFechado = (p: Props) => (
  <Base {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Base>
);

export const IconePausa = (p: Props) => (
  <Base {...p}>
    <rect x="7" y="5" width="3.4" height="14" rx="1.2" />
    <rect x="13.6" y="5" width="3.4" height="14" rx="1.2" />
  </Base>
);

export const IconePlay = (p: Props) => (
  <Base {...p}>
    <path d="M7.5 5.2 18.8 12 7.5 18.8V5.2Z" />
  </Base>
);

export const IconeSeta = (p: Props) => (
  <Base {...p}>
    <path d="M6 9.5 12 15l6-5.5" />
  </Base>
);

export const IconeRelogio = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.3V12l3 1.8" />
  </Base>
);

export const IconeMenu = (p: Props) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const IconeSair = (p: Props) => (
  <Base {...p}>
    <path d="M14.5 16.5 19 12l-4.5-4.5M19 12H9" />
    <path d="M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H11" />
  </Base>
);

/** Mapa canal → ícone, para as tags de pedido. */
export const ICONE_DO_CANAL = {
  DELIVERY: IconeEntregas,
  DINE_IN: IconeSalao,
  COUNTER: IconeCaixa,
} as const;

/* ---------------- editor de cardápio ---------------- */

export const IconeSubir = (p: Props) => (
  <Base {...p}>
    <path d="M12 19V6M6 11.5 12 5.5l6 6" />
  </Base>
);

export const IconeDescer = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v13M6 12.5l6 6 6-6" />
  </Base>
);

export const IconeOlho = (p: Props) => (
  <Base {...p}>
    <path d="M2.5 12s3.6-6.2 9.5-6.2S21.5 12 21.5 12s-3.6 6.2-9.5 6.2S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </Base>
);

export const IconeOlhoCortado = (p: Props) => (
  <Base {...p}>
    <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.8c5.9 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3 3.7M6.4 7.5A16.6 16.6 0 0 0 2.5 12s3.6 6.2 9.5 6.2c1.5 0 2.8-.4 4-.9" />
    <path d="M4 4l16 16" />
  </Base>
);

export const IconeLixeira = (p: Props) => (
  <Base {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
    <path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
    <path d="M10.5 10.5v6M13.5 10.5v6" />
  </Base>
);

export const IconeLapis = (p: Props) => (
  <Base {...p}>
    <path d="M4.5 19.5h3.2L18.9 8.3a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L4.5 16.3v3.2Z" />
    <path d="M14.8 6.6l2.6 2.6" />
  </Base>
);

export const IconeCopiar = (p: Props) => (
  <Base {...p}>
    <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
    <path d="M15.5 5.5v-.5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h.5" />
  </Base>
);

export const IconeFechar = (p: Props) => (
  <Base {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Base>
);

/* ---------------- diversos ---------------- */

export const IconeCartao = (p: Props) => (
  <Base {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 9.5h19M6 15h3.5" />
  </Base>
);

export const IconeDinheiro = (p: Props) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5v0M18 14.5v0" />
  </Base>
);

export const IconeCelular = (p: Props) => (
  <Base {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </Base>
);

export const IconeRecibo = (p: Props) => (
  <Base {...p}>
    <path d="M5.5 2.8h13v18.4l-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5-2.1-1.5-2.2 1.5V2.8Z" />
    <path d="M9 8h6M9 12h4" />
  </Base>
);

export const IconeAlerta = (p: Props) => (
  <Base {...p}>
    <path d="M10.6 3.9 2.9 17.2a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 3.9a1.6 1.6 0 0 0-2.8 0Z" />
    <path d="M12 9.5v4M12 17v0" />
  </Base>
);

export const IconeGrafico = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 16.5 9 11l4 3.5 7.5-8" />
    <path d="M15.5 6.5h5v5" />
  </Base>
);

export const IconeBaixar = (p: Props) => (
  <Base {...p}>
    <path d="M12 3.5v11M7.5 10 12 14.5 16.5 10" />
    <path d="M4.5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
  </Base>
);

export const IconeProibido = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M6 6l12 12" />
  </Base>
);

export const IconeEtiqueta = (p: Props) => (
  <Base {...p}>
    <path d="M11.6 3.5H4.5a1 1 0 0 0-1 1v7.1a2 2 0 0 0 .6 1.4l7.4 7.4a1.4 1.4 0 0 0 2 0l6.5-6.5a1.4 1.4 0 0 0 0-2L12.6 4a2 2 0 0 0-1-.5Z" />
    <circle cx="8" cy="8" r="1.3" />
  </Base>
);

export const IconeSemInternet = (p: Props) => (
  <Base {...p}>
    <path d="M3 8.5a15 15 0 0 1 5-3M16 5.5a15 15 0 0 1 5 3" />
    <path d="M6.5 12.5a10 10 0 0 1 3-1.8M14.5 10.7a10 10 0 0 1 3 1.8" />
    <path d="M9.8 16.2a5 5 0 0 1 4.4 0" />
    <path d="M12 19.8v0M3.5 3.5l17 17" />
  </Base>
);

export const IconeAmpulheta = (p: Props) => (
  <Base {...p}>
    <path d="M7 3.5h10M7 20.5h10" />
    <path d="M8 3.5v3.2c0 1.6 1.4 2.6 2.6 4 .8.9.8 1.7 0 2.6-1.2 1.4-2.6 2.4-2.6 4v3.2M16 3.5v3.2c0 1.6-1.4 2.6-2.6 4-.8.9-.8 1.7 0 2.6 1.2 1.4 2.6 2.4 2.6 4v3.2" />
  </Base>
);

export const IconeMaoLevantada = (p: Props) => (
  <Base {...p}>
    <path d="M8.5 11V5.2a1.4 1.4 0 0 1 2.8 0V10M11.3 10V4.2a1.4 1.4 0 0 1 2.8 0V10M14.1 10.4V6.2a1.4 1.4 0 0 1 2.8 0v6.6c0 4-2.4 7.7-6 7.7-2.6 0-4.2-1.4-5.5-4L4 14.2a1.4 1.4 0 0 1 2.2-1.7l2.3 2.3" />
  </Base>
);

export const IconeLinkExterno = (p: Props) => (
  <Base {...p}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19.5 4.5 11 13" />
    <path d="M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10" />
  </Base>
);

export const IconeMegafone = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 9.5v4a1.5 1.5 0 0 0 1.5 1.5h2l8 5V4l-8 5H5a1.5 1.5 0 0 0-1.5 1.5Z" />
    <path d="M18.5 9.5a4 4 0 0 1 0 5" />
  </Base>
);

export const IconeCarrinho = (p: Props) => (
  <Base {...p}>
    <path d="M3 4h2l.6 3M7 12h10l3-6H6.6M7 12l-.4 2.5A1 1 0 0 0 7.6 16H18" />
    <circle cx="9" cy="19" r="1.3" />
    <circle cx="17" cy="19" r="1.3" />
  </Base>
);

export const IconeEstrela = (p: Props) => (
  <Base {...p}>
    <path d="M12 3.8l2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.8Z" />
  </Base>
);

/* ---------------- modo de exibição ---------------- */

export const IconeCards = (p: Props) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" />
    <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.8" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.8" />
    <rect x="13" y="13" width="7.5" height="7.5" rx="1.8" />
  </Base>
);

export const IconeLista = (p: Props) => (
  <Base {...p}>
    <path d="M9 6.5h11.5M9 12h11.5M9 17.5h11.5" />
    <path d="M4 6.5h1M4 12h1M4 17.5h1" />
  </Base>
);
