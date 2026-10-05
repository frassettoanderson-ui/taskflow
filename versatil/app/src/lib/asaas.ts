// Cliente mínimo da API v3 do Asaas. Sem ASAAS_API_KEY => modo demonstração (nada sai da máquina).
import { randomBytes } from "node:crypto";

export const modoDemo = () => !process.env.ASAAS_API_KEY;

const base = () =>
  process.env.ASAAS_ENV === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

async function req<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(base() + caminho, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY!,
      "User-Agent": "l3salvados-loja",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  const txt = await r.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!r.ok) {
    const msg = json?.errors?.map((e: { description: string }) => e.description).join("; ") || r.statusText;
    throw new Error(`Asaas ${metodo} ${caminho}: ${msg}`);
  }
  return json as T;
}

export async function garantirCliente(c: { nome: string; cpf: string; telefone: string; email?: string | null }) {
  if (modoDemo()) return "cus_demo_" + c.cpf;
  const achou = await req<{ data: { id: string }[] }>("GET", `/customers?cpfCnpj=${c.cpf}`);
  if (achou.data?.[0]) return achou.data[0].id;
  const novo = await req<{ id: string }>("POST", "/customers", {
    name: c.nome,
    cpfCnpj: c.cpf,
    mobilePhone: c.telefone,
    email: c.email || undefined,
    notificationDisabled: true, // avisos saem pelo nosso WhatsApp, não pelo Asaas
  });
  return novo.id;
}

export type Cobranca = { id: string; invoiceUrl?: string; pixPayload?: string };

export async function criarCobranca(p: {
  customerId: string;
  metodo: "PIX" | "CARTAO";
  valorCents: number;
  descricao: string;
  referencia: string;
  splitPercent?: number | null;
}): Promise<Cobranca> {
  if (modoDemo()) {
    const id = "pay_demo_" + randomBytes(6).toString("hex");
    return {
      id,
      invoiceUrl: p.metodo === "CARTAO" ? undefined : undefined,
      pixPayload: p.metodo === "PIX" ? `00020126DEMO-L3-${id}-5204000053039865802BR` : undefined,
    };
  }
  const wallet = process.env.ASAAS_SPLIT_WALLET_ID;
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // data em BRT
  const pg = await req<{ id: string; invoiceUrl: string }>("POST", "/payments", {
    customer: p.customerId,
    billingType: p.metodo === "PIX" ? "PIX" : "CREDIT_CARD",
    value: p.valorCents / 100,
    dueDate: hoje,
    description: p.descricao,
    externalReference: p.referencia,
    split: wallet && p.splitPercent ? [{ walletId: wallet, percentualValue: p.splitPercent }] : undefined,
  });
  let pixPayload: string | undefined;
  if (p.metodo === "PIX") {
    const qr = await req<{ payload: string }>("GET", `/payments/${pg.id}/pixQrCode`);
    pixPayload = qr.payload;
  }
  return { id: pg.id, invoiceUrl: pg.invoiceUrl, pixPayload };
}

export async function removerCobranca(id: string) {
  if (modoDemo()) return;
  await req("DELETE", `/payments/${id}`);
}

export async function estornarCobranca(id: string, valorCents?: number, motivo?: string) {
  if (modoDemo()) return;
  await req("POST", `/payments/${id}/refund`, {
    value: valorCents ? valorCents / 100 : undefined,
    description: motivo,
  });
}
