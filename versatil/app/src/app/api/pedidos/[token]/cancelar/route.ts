import { db } from "@/lib/db";
import { cancelarPedido } from "@/lib/pedidos";

export async function POST(_: Request, ctx: RouteContext<"/api/pedidos/[token]/cancelar">) {
  const p = await db.pedido.findUnique({ where: { acessoToken: (await ctx.params).token }, select: { id: true } });
  if (!p) return Response.json({ erro: "não encontrado" }, { status: 404 });
  const ok = await cancelarPedido(p.id, "cliente");
  return Response.json({ ok });
}
