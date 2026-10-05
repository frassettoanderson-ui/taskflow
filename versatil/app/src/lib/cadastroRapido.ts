// Cadastro rápido (celular): códigos de acesso, esteira de rascunhos (IA + Mercado Livre em segundo plano) e publicação.
import { createHash, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Condicao, Prisma } from "@prisma/client";
import { db } from "./db";
import { getConfig } from "./config";
import { pastaUploads } from "./uploads";
import { slugify } from "./format";
import { lerCodigoBarras } from "./codigoBarras";
import { escreverDescricao, iaDisponivel, identificarPorFoto, pesquisarPreco, type Catalogo, type Identificacao, type ResultadoPreco } from "./precoMercado";
import { usuarioAtual } from "./auth";
import { enfileirar } from "./disparos";
import { cookieSeguro } from "./cookie";

// ---------------- códigos de acesso ----------------

const COOKIE = "vs_cad";
const chave = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-inseguro");
const hashCodigo = (c: string) => createHash("sha256").update(`cad:${c.replace(/\D/g, "")}`).digest("hex");

/** Gera um código de 8 dígitos (mostrado uma vez só) para uma pessoa. */
export async function criarCodigo(nome: string) {
  let codigo = "";
  for (;;) {
    codigo = String(randomInt(10_000_000, 99_999_999));
    if (!(await db.tokenCadastro.findUnique({ where: { hash: hashCodigo(codigo) } }))) break;
  }
  await db.tokenCadastro.create({ data: { nome, hash: hashCodigo(codigo), final: codigo.slice(-2) } });
  return codigo;
}

export async function entrarComCodigo(codigo: string) {
  const t = await db.tokenCadastro.findUnique({ where: { hash: hashCodigo(codigo) } });
  if (!t?.ativo) return false;
  await db.tokenCadastro.update({ where: { id: t.id }, data: { ultimoUsoEm: new Date() } });
  const jwt = await new SignJWT({ sub: t.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(chave());
  (await cookies()).set(COOKIE, jwt, { httpOnly: true, sameSite: "lax", secure: cookieSeguro(), path: "/", maxAge: 60 * 60 * 24 * 30 });
  return true;
}

export async function sairCadastro() {
  (await cookies()).delete(COOKIE);
}

/** Quem está usando o cadastro rápido: código de acesso válido OU usuário ADMIN do painel. */
export async function acessoCadastro(): Promise<{ nome: string } | null> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, chave());
      const t = await db.tokenCadastro.findUnique({ where: { id: String(payload.sub) } });
      if (t?.ativo) return { nome: t.nome };
    } catch {}
  }
  const u = await usuarioAtual();
  return u?.papel === "ADMIN" ? { nome: u.nome } : null;
}

// ---------------- esteira ----------------

export type DadosRascunho = { ident?: Identificacao; catalogo?: Catalogo; descricao?: string; avisoIa?: string };

/** Roda em segundo plano: código de barras → IA → Mercado Livre → descrição. */
export async function processarRascunho(id: string) {
  const r = await db.cadastroRascunho.findUnique({ where: { id } });
  if (!r || r.status !== "PROCESSANDO") return;
  try {
    const bufs = await Promise.all(r.fotos.map((f) => readFile(path.join(/*turbopackIgnore: true*/ pastaUploads(), `${f}.webp`))));
    // código de barras: a 2ª foto é a do código; tenta ela primeiro, depois as outras
    const ordem = [bufs[1], ...bufs.filter((_, i) => i !== 1)].filter(Boolean);
    const ean = r.ean || (await lerCodigoBarras(ordem));
    const cfg = await getConfig();
    const categorias = (await db.categoria.findMany({ select: { nome: true } })).map((c) => c.nome);
    const dados: DadosRascunho = {};
    if (iaDisponivel()) {
      dados.ident = await identificarPorFoto(bufs.map((b) => ({ base64: b.toString("base64"), mimetype: "image/webp" })), categorias, ean);
    } else {
      dados.avisoIa = "IA não configurada: digite o nome do produto e busque o preço.";
      dados.ident = { titulo: "", ean, consulta: "" };
    }
    let preco: ResultadoPreco | null = null;
    let erro: string | null = null;
    const consulta = dados.ident.consulta || ean || "";
    if (consulta) {
      try {
        preco = await pesquisarPreco(consulta, { marca: dados.ident.marca, descontoPct: Number(cfg.preco_desconto_pct) || 30, ean });
        dados.catalogo = preco.catalogo;
      } catch (e) {
        erro = (e as Error).message;
      }
    }
    if (dados.ident.titulo) {
      dados.descricao = await escreverDescricao({ titulo: dados.ident.titulo, visto: dados.ident.descricao, catalogo: dados.catalogo }).catch(() => dados.ident?.descricao ?? "");
    }
    await db.cadastroRascunho.update({
      where: { id },
      data: {
        status: "PRONTO",
        ean: ean ?? null,
        dados: dados as Prisma.InputJsonValue,
        preco: preco ? (preco as unknown as Prisma.InputJsonValue) : undefined,
        erro,
      },
    });
  } catch (e) {
    await db.cadastroRascunho.update({ where: { id }, data: { status: "ERRO", erro: (e as Error).message.slice(0, 500) } });
  }
}

/** Busca de novo (nome digitado/ajustado) para um rascunho já processado. */
export async function rebuscarRascunho(id: string, consulta: string) {
  const r = await db.cadastroRascunho.findUnique({ where: { id } });
  if (!r) throw new Error("Cadastro não encontrado.");
  const cfg = await getConfig();
  const dados = (r.dados ?? {}) as DadosRascunho;
  const preco = await pesquisarPreco(consulta, { marca: dados.ident?.marca, descontoPct: Number(cfg.preco_desconto_pct) || 30, ean: r.ean ?? undefined });
  const titulo = dados.ident?.titulo || preco.catalogo?.nome || consulta;
  const novo: DadosRascunho = {
    ...dados,
    ident: { ...(dados.ident ?? { consulta }), titulo, consulta },
    catalogo: preco.catalogo ?? dados.catalogo,
  };
  novo.descricao = await escreverDescricao({ titulo, visto: dados.ident?.descricao, catalogo: novo.catalogo }).catch(() => dados.descricao ?? "");
  await db.cadastroRascunho.update({ where: { id }, data: { status: "PRONTO", dados: novo as Prisma.InputJsonValue, preco: preco as unknown as Prisma.InputJsonValue, erro: null } });
}

async function slugLivre(base: string) {
  let s = base || "produto";
  for (let n = 2; await db.produto.findUnique({ where: { slug: s }, select: { id: true } }); n++) s = `${base}-${n}`;
  return s;
}

export type Publicacao = {
  titulo: string;
  condicao: Condicao;
  categoriaId: string | null;
  marca: string | null;
  sku: string | null;
  ean: string | null;
  precoCents: number;
  precoMercadoCents: number | null;
  custoCents: number | null;
  quantidade: number;
  descricao: string;
  ficha: { nome: string; valor: string }[];
  rascunho: boolean; // salvar sem publicar na loja
  enviarGrupos: boolean;
};

/** Transforma o rascunho em Produto (fotos vão junto) e coloca na fila de etiquetas. */
export async function publicarRascunho(id: string, p: Publicacao, autor: string) {
  const r = await db.cadastroRascunho.findUnique({ where: { id } });
  if (!r || r.status === "PUBLICADO" || r.status === "DESCARTADO") throw new Error("Este cadastro já foi finalizado.");
  const status = p.rascunho ? "RASCUNHO" : p.quantidade > 0 ? "ATIVO" : "ESGOTADO";
  const slug = await slugLivre(slugify(p.titulo));
  const produto = await db.$transaction(async (tx) => {
    const ok = await tx.cadastroRascunho.updateMany({ where: { id, status: { in: ["PRONTO", "ERRO", "PROCESSANDO"] } }, data: { status: "PUBLICADO" } });
    if (!ok.count) throw new Error("Este cadastro já foi finalizado.");
    const prod = await tx.produto.create({
      data: {
        titulo: p.titulo,
        slug,
        condicao: p.condicao,
        categoriaId: p.categoriaId,
        marca: p.marca,
        sku: p.sku,
        ean: p.ean,
        descricao: p.descricao,
        fichaTecnica: p.ficha as Prisma.InputJsonValue,
        precoCents: p.precoCents,
        precoMercadoCents: p.precoMercadoCents,
        custoCents: p.custoCents,
        estoqueDisponivel: p.quantidade,
        status,
        publicadoEm: status === "ATIVO" ? new Date() : null,
        cadastradoPor: autor,
        etiquetaPendente: true,
        // a foto do código de barras não vai para a loja
        fotos: { create: r.fotos.filter((_, i) => i !== 1).map((arquivo, ordem) => ({ arquivo, ordem })) },
      },
    });
    if (p.quantidade > 0) {
      await tx.movimentoEstoque.create({ data: { produtoId: prod.id, tipo: "CADASTRO", quantidade: p.quantidade, custoUnitCents: p.custoCents ?? undefined, usuario: autor, motivo: "Cadastro rápido" } });
    }
    await tx.cadastroRascunho.update({ where: { id }, data: { produtoId: prod.id } });
    return prod;
  });
  let grupos = 0;
  if (p.enviarGrupos && status === "ATIVO") grupos = await enfileirar(produto.id, "NOVO");
  return { produto, grupos };
}
