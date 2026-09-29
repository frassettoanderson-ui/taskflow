// Conta do cliente na loja (separada da sessão do painel). Comprar continua possível sem cadastro.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "vs_cli";
const chave = () => new TextEncoder().encode((process.env.AUTH_SECRET || "dev-secret-inseguro") + ":cliente");

export async function entrarCliente(clienteId: string) {
  const token = await new SignJWT({ sub: clienteId, t: "cliente" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60d")
    .sign(chave());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}

export async function sairCliente() {
  (await cookies()).delete(COOKIE);
}

export async function clienteAtual() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    if (payload.t !== "cliente") return null;
    const c = await db.cliente.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, nome: true, telefone: true, cpf: true, email: true, senhaHash: true },
    });
    return c?.senhaHash ? { id: c.id, nome: c.nome, telefone: c.telefone, cpf: c.cpf, email: c.email } : null;
  } catch {
    return null;
  }
}
export type ClienteLogado = NonNullable<Awaited<ReturnType<typeof clienteAtual>>>;
