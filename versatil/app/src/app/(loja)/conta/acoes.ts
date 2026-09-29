"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { entrarCliente, sairCliente } from "@/lib/conta";
import { cpfValido, soDigitos } from "@/lib/format";

export type EstadoConta = { erro?: string } | undefined;

const destinoSeguro = (v: FormDataEntryValue | null) => {
  const s = String(v || "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/conta";
};

export async function cadastrar(_: EstadoConta, fd: FormData): Promise<EstadoConta> {
  const nome = String(fd.get("nome") || "").trim();
  const telefone = soDigitos(String(fd.get("telefone") || ""));
  const cpf = soDigitos(String(fd.get("cpf") || ""));
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const senha = String(fd.get("senha") || "");

  if (nome.split(/\s+/).length < 2) return { erro: "Informe nome e sobrenome." };
  if (telefone.length < 10) return { erro: "Informe seu WhatsApp com DDD." };
  if (!cpfValido(cpf)) return { erro: "CPF inválido." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: "E-mail inválido." };
  if (senha.length < 6) return { erro: "A senha precisa ter pelo menos 6 caracteres." };

  const emailEmUso = await db.cliente.findFirst({ where: { email, senhaHash: { not: null }, NOT: { telefone } } });
  if (emailEmUso) return { erro: "Este e-mail já tem cadastro. Entre com sua senha." };

  const existente = await db.cliente.findUnique({ where: { telefone } });
  const senhaHash = await bcrypt.hash(senha, 10);
  let id: string;
  if (existente) {
    if (existente.senhaHash) return { erro: "Este WhatsApp já tem cadastro. Entre com sua senha." };
    // já comprou sem cadastro: só assume a ficha se o CPF bater (protege o histórico de pedidos)
    if (existente.cpf && existente.cpf !== cpf) return { erro: "Este WhatsApp já está ligado a outro CPF. Fale com a loja." };
    id = (await db.cliente.update({ where: { id: existente.id }, data: { nome, cpf, email, senhaHash } })).id;
  } else {
    id = (await db.cliente.create({ data: { nome, telefone, cpf, email, senhaHash } })).id;
  }
  await entrarCliente(id);
  redirect(destinoSeguro(fd.get("voltar")));
}

export async function entrar(_: EstadoConta, fd: FormData): Promise<EstadoConta> {
  const login = String(fd.get("login") || "").trim().toLowerCase();
  const senha = String(fd.get("senha") || "");
  const tel = soDigitos(login);
  const cliente = login.includes("@")
    ? await db.cliente.findFirst({ where: { email: login, senhaHash: { not: null } } })
    : tel.length >= 10
      ? await db.cliente.findUnique({ where: { telefone: tel } })
      : null;
  if (!cliente?.senhaHash || !(await bcrypt.compare(senha, cliente.senhaHash))) return { erro: "Dados de acesso incorretos." };
  await entrarCliente(cliente.id);
  redirect(destinoSeguro(fd.get("voltar")));
}

export async function sair() {
  await sairCliente();
  redirect("/");
}
