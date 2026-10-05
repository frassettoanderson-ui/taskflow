"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { criarCodigo } from "@/lib/cadastroRapido";

export async function criarCodigoAcao(_: unknown, fd: FormData): Promise<{ erro?: string; codigo?: string; nome?: string }> {
  await exigirAdmin();
  const nome = String(fd.get("nome") || "").trim();
  if (nome.length < 2) return { erro: "Informe o nome de quem vai usar." };
  const codigo = await criarCodigo(nome);
  revalidatePath("/painel/usuarios");
  return { codigo, nome };
}

export async function alternarCodigoAcao(id: string, ativo: boolean) {
  await exigirAdmin();
  await db.tokenCadastro.update({ where: { id }, data: { ativo } });
  revalidatePath("/painel/usuarios");
}
