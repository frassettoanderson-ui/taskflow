"use server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Condicao } from "@prisma/client";
import { db } from "@/lib/db";
import { salvarFoto, apagarFoto } from "@/lib/uploads";
import { parseReais } from "@/lib/format";
import { acessoCadastro, entrarComCodigo, processarRascunho, publicarRascunho, rebuscarRascunho, sairCadastro } from "@/lib/cadastroRapido";

const CONDICOES: Condicao[] = ["NOVO_LACRADO", "CAIXA_ABERTA", "AVARIA_ESTETICA", "SEM_CAIXA", "USADO_REVISADO"];

async function exigirAcesso() {
  const a = await acessoCadastro();
  if (!a) redirect("/recebimento/entrar");
  return a;
}

export async function entrarAcao(_: unknown, fd: FormData): Promise<{ erro?: string }> {
  const codigo = String(fd.get("codigo") || "").replace(/\D/g, "");
  if (codigo.length !== 8) return { erro: "O código tem 8 números." };
  if (!(await entrarComCodigo(codigo))) return { erro: "Código inválido ou cancelado." };
  redirect("/recebimento");
}

export async function sairAcao() {
  await sairCadastro();
  redirect("/recebimento/entrar");
}

/** Recebe as fotos (1ª produto, 2ª código de barras, 3ª etiqueta/ângulo, extras) e põe na esteira. */
export async function enviarFotosAcao(fd: FormData): Promise<{ id?: string; erro?: string }> {
  const a = await exigirAcesso();
  const fotos = fd.getAll("foto").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
  if (fotos.length < 3) return { erro: "Tire pelo menos as 3 fotos: produto, código de barras e etiqueta." };
  const arquivos: string[] = [];
  for (const [i, f] of fotos.entries()) {
    try {
      arquivos.push(await salvarFoto(Buffer.from(await f.arrayBuffer())));
    } catch {
      for (const a of arquivos) await apagarFoto(a);
      return { erro: `A foto ${i + 1} não é uma imagem válida. Tire de novo.` };
    }
  }
  const r = await db.cadastroRascunho.create({ data: { fotos: arquivos, autor: a.nome } });
  after(() => processarRascunho(r.id)); // IA + Mercado Livre em segundo plano: a pessoa já fotografa o próximo
  return { id: r.id };
}

/** Situação da esteira (a tela consulta a cada poucos segundos). */
export async function esteiraAcao() {
  await exigirAcesso();
  const itens = await db.cadastroRascunho.findMany({
    where: { status: { in: ["PROCESSANDO", "PRONTO", "ERRO"] } },
    orderBy: { criadoEm: "desc" },
    take: 50,
    select: { id: true, status: true, fotos: true, dados: true, preco: true, erro: true, autor: true, criadoEm: true },
  });
  return itens.map((i) => ({
    id: i.id,
    status: i.status,
    foto: i.fotos[0],
    titulo: ((i.dados as { ident?: { titulo?: string } } | null)?.ident?.titulo) || "",
    sugeridoCents: (i.preco as { sugeridoCents?: number } | null)?.sugeridoCents ?? null,
    erro: i.erro,
    autor: i.autor,
    criadoEm: i.criadoEm.toISOString(),
  }));
}

export async function rebuscarAcao(id: string, consulta: string): Promise<{ erro?: string }> {
  await exigirAcesso();
  if (!consulta.trim()) return { erro: "Digite o nome ou modelo do produto." };
  try {
    await rebuscarRascunho(id, consulta.trim());
  } catch (e) {
    return { erro: (e as Error).message };
  }
  revalidatePath(`/recebimento/${id}`);
  return {};
}

export async function publicarAcao(_: unknown, fd: FormData): Promise<{ erro?: string; ok?: string }> {
  const a = await exigirAcesso();
  const id = String(fd.get("id") || "");
  const titulo = String(fd.get("titulo") || "").trim();
  const precoCents = parseReais(String(fd.get("preco") || ""));
  const condicao = String(fd.get("condicao")) as Condicao;
  const quantidade = Math.floor(Number(fd.get("quantidade") || 0));
  if (titulo.length < 3) return { erro: "Dê um nome ao produto." };
  if (!precoCents) return { erro: "Informe o preço de venda." };
  if (!CONDICOES.includes(condicao)) return { erro: "Escolha a condição." };
  if (!Number.isFinite(quantidade) || quantidade < 1) return { erro: "Quantidade mínima: 1." };
  const nomes = fd.getAll("fichaNome").map(String);
  const valores = fd.getAll("fichaValor").map(String);
  const ficha = nomes.map((nome, i) => ({ nome: nome.trim(), valor: (valores[i] || "").trim() })).filter((f) => f.nome && f.valor);
  let msg = "";
  try {
    const { produto, grupos } = await publicarRascunho(
      id,
      {
        titulo,
        condicao,
        categoriaId: String(fd.get("categoriaId") || "") || null,
        marca: String(fd.get("marca") || "").trim() || null,
        sku: String(fd.get("sku") || "").trim() || null,
        ean: String(fd.get("ean") || "").replace(/\D/g, "") || null,
        precoCents,
        precoMercadoCents: parseReais(String(fd.get("precoMercado") || "")),
        custoCents: parseReais(String(fd.get("custo") || "")),
        quantidade,
        descricao: String(fd.get("descricao") || "").trim(),
        ficha,
        rascunho: fd.get("modo") === "rascunho",
        enviarGrupos: fd.get("enviarGrupos") === "on",
      },
      a.nome,
    );
    revalidatePath("/");
    revalidatePath("/painel/produtos");
    revalidatePath("/painel/etiquetas");
    msg = `${produto.titulo} ${fd.get("modo") === "rascunho" ? "salvo como rascunho" : "publicado"}${grupos ? ` e na fila de ${grupos} grupo(s)` : ""}.`;
  } catch (e) {
    return { erro: (e as Error).message };
  }
  redirect(`/recebimento/novo?ok=${encodeURIComponent(msg)}`);
}

export async function descartarAcao(id: string) {
  await exigirAcesso();
  const r = await db.cadastroRascunho.findUnique({ where: { id } });
  if (!r || r.status === "PUBLICADO") return;
  await db.cadastroRascunho.update({ where: { id }, data: { status: "DESCARTADO" } });
  for (const f of r.fotos) await apagarFoto(f);
  redirect("/recebimento");
}
