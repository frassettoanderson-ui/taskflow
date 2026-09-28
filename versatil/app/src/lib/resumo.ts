import QRCode from "qrcode";
import { db } from "./db";
import { modoDemo } from "./asaas";

/** Visão pública do pedido (página do cliente + polling). Nunca expõe CPF/telefone. */
export async function resumoPedido(token: string) {
  const p = await db.pedido.findUnique({
    where: { acessoToken: token },
    include: { itens: { include: { produto: { select: { slug: true, fotos: { select: { arquivo: true }, take: 1, orderBy: { ordem: "asc" } } } } } }, cliente: { select: { nome: true } } },
  });
  if (!p) return null;
  const aguardando = p.status === "AGUARDANDO_PAGAMENTO";
  const pago = ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO"].includes(p.status);
  return {
    numero: p.numero,
    status: p.status,
    metodo: p.metodo,
    totalCents: p.totalCents,
    estornoCents: p.estornoCents,
    primeiroNome: p.cliente.nome.split(" ")[0],
    expiraEm: aguardando ? p.expiraEm?.toISOString() ?? null : null,
    pixPayload: aguardando ? p.pixPayload : null,
    pixQr: aguardando && p.pixPayload ? await QRCode.toDataURL(p.pixPayload, { margin: 1, width: 320 }) : null,
    invoiceUrl: aguardando ? p.invoiceUrl : null,
    codigoRetirada: pago ? p.codigoRetirada : null,
    retiradaQr: pago && p.codigoRetirada ? await QRCode.toDataURL(`VERSATIL-${p.numero}-${p.codigoRetirada}`, { margin: 1, width: 280, color: { dark: "#0B0B0C", light: "#F5F1E8" } }) : null,
    alerta: p.alerta,
    demo: modoDemo(),
    itens: p.itens.map((i) => ({ titulo: i.titulo, quantidade: i.quantidade, precoUnitCents: i.precoUnitCents, slug: i.produto.slug, foto: i.produto.fotos[0]?.arquivo ?? null })),
  };
}
export type ResumoPedido = NonNullable<Awaited<ReturnType<typeof resumoPedido>>>;
