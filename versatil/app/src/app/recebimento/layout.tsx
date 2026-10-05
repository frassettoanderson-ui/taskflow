import type { Metadata, Viewport } from "next";
import { MARCA } from "@/lib/marca";

export const metadata: Metadata = {
  title: { absolute: `Cadastro · ${MARCA.nome}`, template: `%s · Cadastro ${MARCA.nome}` },
  robots: { index: false },
  appleWebApp: { capable: true, title: "Cadastro L3", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#0b0b0c", width: "device-width", initialScale: 1, maximumScale: 1 };

/** Cadastro rápido: tela própria, sem o menu do painel, feita para o celular. */
export default function LayoutCadastro({ children }: LayoutProps<"/recebimento">) {
  return <div className="mx-auto min-h-dvh max-w-lg bg-[#f5f5f5] pb-28">{children}</div>;
}
