"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Condicao, StatusProduto } from "@prisma/client";
import { db } from "@/lib/db";
import { criarSessao, encerrarSessao, exigirUsuario } from "@/lib/auth";
import { setConfig, CONFIG_PADRAO, type ChaveConfig } from "@/lib/config";
import { parseReais, slugify, soDigitos } from "@/lib/format";
import { salvarFoto, apagarFoto } from "@/lib/uploads";
import { avancarStatus, cancelarPedido, estornarPedido, ErroValidacao } from "@/lib/pedidos";

export type Estado = { erro?: string; ok?: string } | undefined;

// ---------- sessão ----------

export async function entrar(_: Estado, fd: FormData): Promise<Estado> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const senha = String(fd.get("senha") || "");
  const u = await db.usuario.findUnique({ where: { email } });
  if (!u || !u.ativo || !(await bcrypt.compare(senha, u.senhaHash))) return { erro: "E-mail ou senha incorretos." };
  await criarSessao(u.id);
  redirect("/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/painel/login");
}

// ---------- produtos ----------

const CONDICOES: Condicao[] = ["NOVO_LACRADO", "CAIXA_ABERTA", "AVARIA_ESTETICA", "SEM_CAIXA", "USADO_REVISADO"];

async function slugLivre(base: string, id?: string) {
  let s = base || "produto";
  for (let n = 2; ; n++) {
    const outro = await db.produto.findUnique({ where: { slug: s }, select: { id: true } });
    if (!outro || outro.id === id) return s;
    s = `${base}-${n}`;
  }
}

export async function salvarProduto(_: Estado, fd: FormData): Promise<Estado> {
  await exigirUsuario();
  const id = String(fd.get("id") || "") || undefined;
  const titulo = String(fd.get("titulo") || "").trim();
  const preco = parseReais(String(fd.get("preco") || ""));
  const mercado = parseReais(String(fd.get("precoMercado") || ""));
  const custo = parseReais(String(fd.get("custo") || ""));
  const estoque = Math.floor(Number(fd.get("estoque") || 0));
  const estoqueAnterior = Number(fd.get("estoqueAnterior") ?? -1);
  const condicao = String(fd.get("condicao")) as Condicao;
  const statusPedido = String(fd.get("status") || "ATIVO") as StatusProduto;
  const categoriaId = String(fd.get("categoriaId") || "") || null;

  if (titulo.length < 3) return { erro: "Dê um título ao produto." };
  if (!preco) return { erro: "Informe o preço de venda." };
  if (!CONDICOES.includes(condicao)) return { erro: "Escolha a condição." };
  if (!Number.isFinite(estoque) || estoque < 0) return { erro: "Estoque inválido." };

  const fotosNovas = fd.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
  const remover = fd.getAll("removerFoto").map(String);
  const slug = await slugLivre(slugify(titulo), id);

  let produtoId = id;
  if (!id) {
    const status: StatusProduto = statusPedido === "RASCUNHO" ? "RASCUNHO" : estoque > 0 ? "ATIVO" : "ESGOTADO";
    const p = await db.produto.create({
      data: {
        titulo, slug, condicao, categoriaId,
        descricao: String(fd.get("descricao") || ""),
        precoCents: preco, precoMercadoCents: mercado, custoCents: custo,
        estoqueDisponivel: estoque, status,
        publicadoEm: status === "ATIVO" ? new Date() : null,
      },
    });
    produtoId = p.id;
  } else {
    const atual = await db.produto.findUnique({ where: { id } });
    if (!atual) return { erro: "Produto não encontrado." };
    // estoque só muda se ninguém reservou/comprou no meio da edição (compare-and-set)
    const mexeuEstoque = estoque !== estoqueAnterior;
    let status: StatusProduto = statusPedido;
    const dispFinal = mexeuEstoque ? estoque : atual.estoqueDisponivel;
    if (status === "ATIVO" && dispFinal === 0 && atual.estoqueReservado === 0) status = "ESGOTADO";
    if (statusPedido === "ESGOTADO" && dispFinal > 0) status = "ATIVO";
    const r = await db.produto.updateMany({
      where: { id, ...(mexeuEstoque ? { estoqueDisponivel: estoqueAnterior } : {}) },
      data: {
        titulo, slug, condicao, categoriaId,
        descricao: String(fd.get("descricao") || ""),
        precoCents: preco, precoMercadoCents: mercado, custoCents: custo,
        ...(mexeuEstoque ? { estoqueDisponivel: estoque } : {}),
        status,
        ...(status === "ATIVO" && !atual.publicadoEm ? { publicadoEm: new Date() } : {}),
      },
    });
    if (!r.count) return { erro: "O estoque mudou enquanto você editava (alguém comprou ou reservou). Recarregue a página." };
  }

  if (remover.length) {
    const fotos = await db.foto.findMany({ where: { id: { in: remover }, produtoId } });
    for (const f of fotos) await apagarFoto(f.arquivo);
    await db.foto.deleteMany({ where: { id: { in: fotos.map((f) => f.id) } } });
  }
  if (fotosNovas.length) {
    const ult = await db.foto.findFirst({ where: { produtoId }, orderBy: { ordem: "desc" } });
    let ordem = (ult?.ordem ?? -1) + 1;
    for (const f of fotosNovas.slice(0, 10)) {
      const arquivo = await salvarFoto(Buffer.from(await f.arrayBuffer()));
      await db.foto.create({ data: { produtoId: produtoId!, arquivo, ordem: ordem++ } });
    }
  }
  const capa = String(fd.get("capa") || "");
  if (capa) {
    await db.foto.updateMany({ where: { produtoId }, data: { ordem: { increment: 1 } } });
    await db.foto.updateMany({ where: { id: capa, produtoId }, data: { ordem: 0 } });
  }

  revalidatePath("/painel/produtos");
  revalidatePath("/");
  redirect(`/painel/produtos?salvo=${produtoId}`);
}

// ---------- pedidos ----------

export async function mudarStatusPedido(pedidoId: string, para: "SEPARANDO" | "PRONTO" | "RETIRADO") {
  const u = await exigirUsuario();
  const ok = await avancarStatus(pedidoId, para, u.nome);
  revalidatePath("/painel/pedidos");
  revalidatePath(`/painel/pedidos/${pedidoId}`);
  return ok;
}

export async function cancelarPedidoPainel(pedidoId: string) {
  const u = await exigirUsuario();
  await cancelarPedido(pedidoId, u.nome);
  revalidatePath("/painel/pedidos");
  revalidatePath(`/painel/pedidos/${pedidoId}`);
}

export async function estornar(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  const pedidoId = String(fd.get("pedidoId"));
  const tipo = String(fd.get("tipo"));
  const valor = tipo === "parcial" ? parseReais(String(fd.get("valor") || "")) : undefined;
  if (tipo === "parcial" && !valor) return { erro: "Informe o valor do estorno parcial." };
  try {
    await estornarPedido(pedidoId, {
      valorCents: valor ?? undefined,
      devolverEstoque: fd.get("devolver") === "on",
      motivo: String(fd.get("motivo") || "").trim() || undefined,
      autor: u.nome,
    });
  } catch (e) {
    return { erro: e instanceof ErroValidacao ? e.message : `Falha no estorno: ${(e as Error).message}` };
  }
  revalidatePath(`/painel/pedidos/${pedidoId}`);
  revalidatePath("/painel/pedidos");
  return { ok: "Estorno registrado." };
}

// ---------- retirada no balcão ----------

export async function buscarRetirada(_: Estado, fd: FormData): Promise<Estado & { pedidoId?: string }> {
  await exigirUsuario();
  const t = soDigitos(String(fd.get("codigo") || ""));
  if (!t) return { erro: "Digite o código de retirada ou o número do pedido." };
  const abertos = { in: ["PAGO", "SEPARANDO", "PRONTO"] as ("PAGO" | "SEPARANDO" | "PRONTO")[] };
  const p =
    (t.length === 6 && (await db.pedido.findFirst({ where: { codigoRetirada: t, status: abertos }, select: { id: true } }))) ||
    (await db.pedido.findFirst({ where: { numero: Number(t) }, select: { id: true } }));
  if (!p) return { erro: "Nenhum pedido encontrado com esse código." };
  redirect(`/painel/pedidos/${p.id}?retirada=1`);
}

// ---------- configurações ----------

export async function salvarConfig(_: Estado, fd: FormData): Promise<Estado> {
  await exigirUsuario();
  const valores: Partial<Record<ChaveConfig, string>> = {};
  for (const k of Object.keys(CONFIG_PADRAO) as ChaveConfig[]) {
    const v = fd.get(k);
    if (v !== null) valores[k] = String(v).trim();
  }
  await setConfig(valores);
  revalidatePath("/", "layout");
  return { ok: "Configurações salvas." };
}
