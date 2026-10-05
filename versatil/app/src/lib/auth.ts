import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { cookieSeguro } from "./cookie";

const COOKIE = "vs_sess";
const chave = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-inseguro");

export async function criarSessao(usuarioId: string) {
  const token = await new SignJWT({ sub: usuarioId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(chave());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSeguro(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

export async function usuarioAtual() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    const u = await db.usuario.findUnique({ where: { id: String(payload.sub) } });
    return u?.ativo ? u : null;
  } catch {
    return null;
  }
}

export async function exigirUsuario() {
  const u = await usuarioAtual();
  if (!u) redirect("/painel/login");
  return u;
}

/** Telas de gestão: operador de caixa é mandado para o PDV. */
export async function exigirAdmin() {
  const u = await exigirUsuario();
  if (u.papel !== "ADMIN") redirect("/painel/pdv");
  return u;
}
