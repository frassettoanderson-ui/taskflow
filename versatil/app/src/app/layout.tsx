import type { Metadata, Viewport } from "next";
import { Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { MARCA } from "@/lib/marca";

const sans = Figtree({ variable: "--font-sans", subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL || "http://localhost:3100"),
  title: { default: MARCA.nome, template: `%s · ${MARCA.nome}` },
  description: "Produtos de logística reversa com preço muito abaixo do mercado. Novos, caixa aberta e com avaria estética — conferidos pela nossa equipe.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: MARCA.nome, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#F0CD67", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
