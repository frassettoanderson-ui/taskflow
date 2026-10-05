"use server";
// Preço de mercado no cadastro de produto: identificar pela foto (IA) + pesquisar no Mercado Livre.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { pastaUploads } from "@/lib/uploads";
import { conectarML, identificarPorFoto, pesquisarPreco, type Identificacao, type ResultadoPreco } from "@/lib/precoMercado";

export type RespostaPreco = { ident?: Identificacao; preco?: ResultadoPreco; erro?: string; erroPreco?: string };

/** fd: img (até 3 arquivos novos), foto (nomes de fotos já salvas), consulta (texto opcional), marca. */
export async function pesquisarPrecoAcao(fd: FormData): Promise<RespostaPreco> {
  await exigirAdmin();
  const cfg = await getConfig();
  const descontoPct = Math.min(90, Math.max(0, Number(cfg.preco_desconto_pct) || 30));
  let consulta = String(fd.get("consulta") || "").trim();
  let marca = String(fd.get("marca") || "").trim() || undefined;
  let ident: Identificacao | undefined;

  if (!consulta) {
    const imagens: { base64: string; mimetype: string }[] = [];
    for (const f of fd.getAll("img").slice(0, 3))
      if (f instanceof File && f.size) imagens.push({ base64: Buffer.from(await f.arrayBuffer()).toString("base64"), mimetype: f.type || "image/jpeg" });
    for (const nome of fd.getAll("foto").slice(0, 3 - imagens.length)) {
      const arq = String(nome).replace(/[^\w.-]/g, "");
      try {
        imagens.push({ base64: (await readFile(path.join(/*turbopackIgnore: true*/ pastaUploads(), `${arq}.webp`))).toString("base64"), mimetype: "image/webp" });
      } catch {}
    }
    if (!imagens.length) return { erro: "Adicione uma foto do produto (ou digite o nome) para pesquisar." };
    const categorias = (await db.categoria.findMany({ select: { nome: true } })).map((c) => c.nome);
    try {
      ident = await identificarPorFoto(imagens, categorias);
    } catch (e) {
      return { erro: (e as Error).message };
    }
    consulta = ident.consulta;
    marca = ident.marca || marca;
  }
  try {
    return { ident, preco: await pesquisarPreco(consulta, { marca, descontoPct }) };
  } catch (e) {
    return { ident, erroPreco: (e as Error).message };
  }
}

export async function conectarMLAcao(_: unknown, fd: FormData): Promise<{ ok?: string; erro?: string }> {
  await exigirAdmin();
  const codigo = String(fd.get("codigo") || "").trim();
  if (!codigo) return { erro: "Cole o endereço (ou o código) que apareceu depois de autorizar." };
  try {
    await conectarML(codigo);
  } catch (e) {
    return { erro: `Não consegui conectar: ${(e as Error).message}` };
  }
  revalidatePath("/painel/config");
  return { ok: "Mercado Livre conectado." };
}
