import { db } from "@/lib/db";
import { modoDemo } from "@/lib/asaas";
import { processarPagamento } from "@/lib/pedidos";

/** Só existe no modo demonstração (sem chave Asaas): simula o webhook de pagamento. */
export async function POST(req: Request) {
  if (!modoDemo()) return Response.json({ erro: "indisponível" }, { status: 404 });
  const { token } = await req.json();
  const p = await db.pedido.findUnique({ where: { acessoToken: String(token) }, select: { asaasPaymentId: true } });
  if (!p?.asaasPaymentId) return Response.json({ erro: "não encontrado" }, { status: 404 });
  return Response.json(await processarPagamento(p.asaasPaymentId, "demo"));
}
