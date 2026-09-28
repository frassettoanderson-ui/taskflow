import type { Metadata, Viewport } from "next";
import { Montserrat, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Montserrat({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL || "http://localhost:3100"),
  title: { default: "Versátil — Melhor preço da região", template: "%s · Versátil" },
  description: "Produtos de logística reversa com preço muito abaixo do mercado. Novos, caixa aberta e com avaria estética — conferidos pela nossa equipe.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Versátil", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0B0B0C", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
