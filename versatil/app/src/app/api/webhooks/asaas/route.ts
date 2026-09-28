import { timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { processarPagamento } from "@/lib/pedidos";

const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(req: Request) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN || "";
  const recebido = req.headers.get("asaas-access-token") || "";
  if (!esperado || !igual(esperado, recebido)) return new Response("não autorizado", { status: 401 });

  const corpo = await req.json().catch(() => null);
  if (!corpo?.event) return new Response("ok");
  const paymentId: string | undefined = corpo.payment?.id;
  await db.webhookLog.create({ data: { evento: corpo.event, paymentId, payload: corpo as Prisma.InputJsonValue } });

  try {
    if ((corpo.event === "PAYMENT_RECEIVED" || corpo.event === "PAYMENT_CONFIRMED") && paymentId) {
      await processarPagamento(paymentId, "asaas");
    } else if (corpo.event === "PAYMENT_REFUNDED" && paymentId) {
      const p = await db.pedido.findUnique({ where: { asaasPaymentId: paymentId }, select: { id: true } });
      if (p) await db.eventoPedido.create({ data: { pedidoId: p.id, tipo: "asaas_estorno", descricao: "Asaas confirmou o estorno", autor: "asaas" } });
    }
  } catch (e) {
    console.error("[webhook asaas]", e);
    return new Response("erro", { status: 500 }); // Asaas reenvia; processamento é idempotente
  }
  return new Response("ok");
}
