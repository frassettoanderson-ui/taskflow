"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Condicao, FormaPagamento, StatusProduto } from "@prisma/client";
import { db } from "@/lib/db";
import { criarSessao, encerrarSessao, exigirAdmin, exigirUsuario } from "@/lib/auth";
import { setConfig, CONFIG_PADRAO, type ChaveConfig } from "@/lib/config";
import { parseReais, slugify, soDigitos } from "@/lib/format";
import { salvarFoto, apagarFoto, salvarVideo, apagarVideo } from "@/lib/uploads";
import { avancarStatus, cancelarPedido, estornarPedido, ErroValidacao } from "@/lib/pedidos";
import { cancelarPendentes, enfileirar, processarFila, sincronizarGrupos } from "@/lib/disparos";
import { desconectar, estadoConexao, gerarQrCode, perfilConectado } from "@/lib/evolution";

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
  const u = await exigirAdmin();
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
  const extras = {
    marca: String(fd.get("marca") || "").trim() || null,
    sku: String(fd.get("sku") || "").trim() || null,
    ean: String(fd.get("ean") || "").replace(/\D/g, "") || null,
    estoqueMinimo: Math.max(0, Math.trunc(Number(fd.get("estoqueMinimo") || 0)) || 0),
    aplicacao: String(fd.get("aplicacao") || "")
      .split("\n")
      .map((l) => l.replace(/^[\s✔✅️•-]+/u, "").trim()) // tira ✔️/✅ colados do WhatsApp
      .filter(Boolean)
      .join("\n"),
  };
  const disparar = fd.get("disparar") === "on";
  const videoArquivo = fd.get("videoArquivo");
  const videoLink = String(fd.get("videoLink") || "").trim();
  const removerVideo = fd.get("removerVideo") === "on";
  if (videoLink && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(videoLink)) return { erro: "O link do vídeo precisa ser do YouTube." };
  if (videoArquivo instanceof File && videoArquivo.size > 75 * 1024 * 1024) return { erro: "Vídeo muito grande (máximo 75 MB). Grave mais curto ou em qualidade menor." };

  if (titulo.length < 3) return { erro: "Dê um título ao produto." };
  if (!preco) return { erro: "Informe o preço de venda." };
  if (!CONDICOES.includes(condicao)) return { erro: "Escolha a condição." };
  if (!Number.isFinite(estoque) || estoque < 0) return { erro: "Estoque inválido." };

  const fotosNovas = fd.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
  const remover = fd.getAll("removerFoto").map(String);
  const slug = await slugLivre(slugify(titulo), id);

  let produtoId = id;
  let tipoDisparo: "NOVO" | "PROMOCAO" | "REENVIO" = "NOVO";
  if (!id) {
    const status: StatusProduto = statusPedido === "RASCUNHO" ? "RASCUNHO" : estoque > 0 ? "ATIVO" : "ESGOTADO";
    const p = await db.produto.create({
      data: {
        titulo, slug, condicao, categoriaId,
        descricao: String(fd.get("descricao") || ""),
        ...extras,
        precoCents: preco, precoMercadoCents: mercado, custoCents: custo,
        estoqueDisponivel: estoque, status,
        publicadoEm: status === "ATIVO" ? new Date() : null,
      },
    });
    produtoId = p.id;
    if (estoque > 0) await db.movimentoEstoque.create({ data: { produtoId: p.id, tipo: "CADASTRO", quantidade: estoque, custoUnitCents: custo ?? undefined, usuario: u.nome } });
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
        ...extras,
        precoCents: preco, precoMercadoCents: mercado, custoCents: custo,
        ...(mexeuEstoque ? { estoqueDisponivel: estoque } : {}),
        status,
        ...(status === "ATIVO" && !atual.publicadoEm ? { publicadoEm: new Date() } : {}),
      },
    });
    if (!r.count) return { erro: "O estoque mudou enquanto você editava (alguém comprou ou reservou). Recarregue a página." };
    if (mexeuEstoque)
      await db.movimentoEstoque.create({ data: { produtoId: id, tipo: "AJUSTE", quantidade: estoque - estoqueAnterior, motivo: "Alterado no cadastro do produto", usuario: u.nome } });
    tipoDisparo = preco < atual.precoCents ? "PROMOCAO" : atual.publicadoEm ? "REENVIO" : "NOVO";
    if (status !== "ATIVO") await cancelarPendentes(id, "produto saiu da loja");
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
  // vídeo: arquivo enviado tem prioridade; depois link do YouTube; "remover" limpa
  const atualVideo = (await db.produto.findUnique({ where: { id: produtoId }, select: { videoUrl: true } }))?.videoUrl;
  let novoVideo: string | null | undefined;
  if (videoArquivo instanceof File && videoArquivo.size > 0) novoVideo = await salvarVideo(Buffer.from(await videoArquivo.arrayBuffer()), videoArquivo.name);
  else if (videoLink && videoLink !== atualVideo) novoVideo = videoLink;
  else if (removerVideo || (!videoLink && atualVideo && !atualVideo.startsWith("/api/video/"))) novoVideo = null;
  if (novoVideo !== undefined && novoVideo !== atualVideo) {
    await apagarVideo(atualVideo);
    await db.produto.update({ where: { id: produtoId }, data: { videoUrl: novoVideo } });
  }

  const capa = String(fd.get("capa") || "");
  if (capa) {
    await db.foto.updateMany({ where: { produtoId }, data: { ordem: { increment: 1 } } });
    await db.foto.updateMany({ where: { id: capa, produtoId }, data: { ordem: 0 } });
  }

  let enfileirados = 0;
  if (disparar) {
    const final = await db.produto.findUnique({ where: { id: produtoId }, select: { status: true, estoqueDisponivel: true } });
    if (final?.status === "ATIVO" && final.estoqueDisponivel > 0) enfileirados = await enfileirar(produtoId!, tipoDisparo);
  }

  revalidatePath("/painel/produtos");
  revalidatePath("/");
  redirect(`/painel/produtos?salvo=${produtoId}${enfileirados ? `&grupos=${enfileirados}` : ""}`);
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
  const u = await exigirAdmin();
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
      forma: (String(fd.get("forma") || "") || undefined) as FormaPagamento | undefined,
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
  await exigirAdmin();
  const valores: Partial<Record<ChaveConfig, string>> = {};
  for (const k of Object.keys(CONFIG_PADRAO) as ChaveConfig[]) {
    const todos = fd.getAll(k); // checkbox + hidden: vale o último
    if (todos.length) valores[k] = String(todos[todos.length - 1]).trim();
  }
  await setConfig(valores);
  revalidatePath("/", "layout");
  return { ok: "Configurações salvas." };
}

// ---------- disparos nos grupos ----------

export async function alternarFila(ativo: boolean) {
  await exigirAdmin();
  await setConfig({ disparo_ativo: ativo ? "1" : "0" });
  revalidatePath("/painel/disparos");
}

export async function alternarGrupo(grupoId: string, ativo: boolean) {
  await exigirAdmin();
  await db.grupo.update({ where: { id: grupoId }, data: { ativo } });
  if (!ativo) await db.disparo.updateMany({ where: { grupoId, status: "PENDENTE" }, data: { status: "CANCELADO", erro: "grupo desativado" } });
  revalidatePath("/painel/disparos");
}

export async function sincronizarGruposAcao(): Promise<Estado> {
  await exigirAdmin();
  try {
    const r = await sincronizarGrupos();
    revalidatePath("/painel/disparos");
    return { ok: `${r.total} grupo(s) encontrados${r.novos ? `, ${r.novos} novo(s) — ative os que devem receber ofertas` : ""}.` };
  } catch (e) {
    return { erro: `Não consegui buscar os grupos: ${(e as Error).message}` };
  }
}

// ---------- conexão do número de disparo ----------

export async function estadoWhatsAcao() {
  await exigirAdmin();
  const estado = await estadoConexao();
  return { estado, perfil: estado === "open" ? await perfilConectado() : null };
}

export async function gerarQrAcao(): Promise<{ qr?: string; codigo?: string; conectado?: boolean; erro?: string }> {
  await exigirAdmin();
  try {
    return await gerarQrCode();
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Chamado quando o número acabou de conectar: já traz os grupos em que ele está. */
export async function aoConectarAcao() {
  await exigirAdmin();
  try {
    await sincronizarGrupos();
  } catch {}
  revalidatePath("/painel/disparos");
}

export async function desconectarWhatsAcao(): Promise<Estado> {
  await exigirAdmin();
  try {
    await desconectar();
  } catch (e) {
    return { erro: (e as Error).message };
  }
  revalidatePath("/painel/disparos");
  return { ok: "Número desconectado." };
}

export async function dispararProduto(produtoId: string) {
  await exigirAdmin();
  const n = await enfileirar(produtoId, "REENVIO");
  revalidatePath("/painel/disparos");
  return n;
}

export async function cancelarFilaProduto(produtoId: string) {
  await exigirAdmin();
  await cancelarPendentes(produtoId, "cancelado pelo painel");
  revalidatePath("/painel/disparos");
}

/** Força uma tentativa de envio agora (ignora só o intervalo global; respeita horário/limites). */
export async function enviarProximo() {
  await exigirAdmin();
  await db.config.deleteMany({ where: { chave: "disparo_proximo" } });
  const r = await processarFila();
  revalidatePath("/painel/disparos");
  return r;
}
