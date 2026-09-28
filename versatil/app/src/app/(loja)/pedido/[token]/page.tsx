import { notFound } from "next/navigation";
import { resumoPedido } from "@/lib/resumo";
import { expirarPedidos } from "@/lib/pedidos";
import { getConfig } from "@/lib/config";
import { AcompanharPedido } from "./AcompanharPedido";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seu pedido", robots: { index: false } };

export default async function PaginaPedido({ params }: PageProps<"/pedido/[token]">) {
  await expirarPedidos();
  const { token } = await params;
  const r = await resumoPedido(token);
  if (!r) notFound();
  const cfg = await getConfig();
  return <AcompanharPedido token={token} inicial={r} endereco={cfg.loja_endereco} horario={cfg.loja_horario} whatsapp={cfg.loja_whatsapp} />;
}
