import { resumoPedido } from "@/lib/resumo";
import { expirarPedidos } from "@/lib/pedidos";

export async function GET(_: Request, ctx: RouteContext<"/api/pedidos/[token]">) {
  await expirarPedidos();
  const r = await resumoPedido((await ctx.params).token);
  if (!r) return Response.json({ erro: "não encontrado" }, { status: 404 });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
