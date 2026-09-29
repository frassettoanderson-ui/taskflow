"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormaPagamento, Papel } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirAdmin, exigirUsuario } from "@/lib/auth";
import { parseReais, soDigitos } from "@/lib/format";
import { ErroIndisponivel, ErroValidacao } from "@/lib/pedidos";
import { abrirCaixa, ajustarEstoque, fecharCaixa, movimentarCaixa, registrarCompra, venderNoBalcao, type ItemPDV, type PagamentoPDV } from "@/lib/lojafisica";

export type Estado = { erro?: string; ok?: string } | undefined;
const msg = (e: unknown) => (e instanceof ErroValidacao || e instanceof ErroIndisponivel ? e.message : `Erro: ${(e as Error).message}`);
const FORMAS_OK: FormaPagamento[] = ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "OUTRO"];

// ---------------- caixa ----------------

export async function abrirCaixaAcao(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  try {
    await abrirCaixa(parseReais(String(fd.get("troco") || "0")) ?? 0, u.nome);
  } catch (e) {
    return { erro: msg(e) };
  }
  revalidatePath("/painel/caixa");
  revalidatePath("/painel/pdv");
  return { ok: "Caixa aberto." };
}

export async function movimentarCaixaAcao(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  const tipo = fd.get("tipo") === "SUPRIMENTO" ? "SUPRIMENTO" : "SANGRIA";
  try {
    await movimentarCaixa(tipo, parseReais(String(fd.get("valor") || "")) ?? 0, String(fd.get("descricao") || "").trim(), u.nome);
  } catch (e) {
    return { erro: msg(e) };
  }
  revalidatePath("/painel/caixa");
  return { ok: tipo === "SANGRIA" ? "Sangria registrada." : "Suprimento registrado." };
}

export async function fecharCaixaAcao(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  const contagem: Partial<Record<FormaPagamento, number>> = {};
  for (const f of FORMAS_OK) {
    const v = parseReais(String(fd.get(`contagem_${f}`) || ""));
    if (v !== null) contagem[f] = v;
  }
  let id = "";
  try {
    const r = await fecharCaixa(contagem, String(fd.get("observacao") || "").trim(), u.nome);
    id = r.caixa.id;
  } catch (e) {
    return { erro: msg(e) };
  }
  revalidatePath("/painel/caixa");
  redirect(`/painel/caixa/${id}`);
}

// ---------------- PDV ----------------

export type ResultadoVenda = { ok: true; pedidoId: string; numero: number; troco: number; total: number } | { ok: false; erro: string; produtoId?: string };

export async function venderAcao(dados: {
  itens: ItemPDV[];
  descontoCents: number;
  pagamentos: PagamentoPDV[];
  cliente?: { nome?: string; telefone?: string; cpf?: string };
}): Promise<ResultadoVenda> {
  const u = await exigirUsuario();
  try {
    const pagamentos = (dados.pagamentos || []).filter((p) => FORMAS_OK.includes(p.forma)).map((p) => ({ forma: p.forma, valorCents: Math.round(Number(p.valorCents) || 0) }));
    const r = await venderNoBalcao({ itens: dados.itens, descontoCents: Math.round(Number(dados.descontoCents) || 0), pagamentos, cliente: dados.cliente, operador: u.nome });
    revalidatePath("/painel/pdv");
    revalidatePath("/painel/caixa");
    revalidatePath("/");
    return { ok: true, pedidoId: r.pedido.id, numero: r.pedido.numero, troco: r.troco, total: r.total };
  } catch (e) {
    return { ok: false, erro: msg(e), produtoId: e instanceof ErroIndisponivel ? e.produtoId : undefined };
  }
}

// ---------------- estoque ----------------

export async function ajustarEstoqueAcao(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirAdmin();
  const tipo = fd.get("tipo") === "PERDA" ? "PERDA" : "AJUSTE";
  const direcao = fd.get("direcao") === "menos" || tipo === "PERDA" ? -1 : 1;
  const q = Math.abs(Math.trunc(Number(fd.get("quantidade") || 0))) * direcao;
  try {
    await ajustarEstoque(String(fd.get("produtoId")), { tipo, quantidade: q, motivo: String(fd.get("motivo") || "").trim(), usuario: u.nome });
  } catch (e) {
    return { erro: msg(e) };
  }
  revalidatePath("/painel/estoque");
  revalidatePath("/");
  return { ok: "Estoque atualizado." };
}

export async function salvarMinimoAcao(produtoId: string, minimo: number) {
  await exigirAdmin();
  await db.produto.update({ where: { id: produtoId }, data: { estoqueMinimo: Math.max(0, Math.trunc(minimo) || 0) } });
  revalidatePath("/painel/estoque");
}

// ---------------- compras / fornecedores ----------------

export async function salvarFornecedorAcao(_: Estado, fd: FormData): Promise<Estado> {
  await exigirAdmin();
  const nome = String(fd.get("nome") || "").trim();
  if (nome.length < 2) return { erro: "Informe o nome do fornecedor." };
  const dados = {
    nome,
    documento: soDigitos(String(fd.get("documento") || "")) || null,
    telefone: soDigitos(String(fd.get("telefone") || "")) || null,
    email: String(fd.get("email") || "").trim() || null,
    observacao: String(fd.get("observacao") || "").trim() || null,
  };
  const id = String(fd.get("id") || "");
  if (id) await db.fornecedor.update({ where: { id }, data: dados });
  else await db.fornecedor.create({ data: dados });
  revalidatePath("/painel/compras");
  return { ok: "Fornecedor salvo." };
}

export async function registrarCompraAcao(dados: {
  fornecedorId?: string;
  itens: { produtoId: string; quantidade: number; custoUnitCents: number }[];
  notaFiscal?: string;
  observacao?: string;
  pago: boolean;
  vencimento?: string;
  forma?: FormaPagamento;
}): Promise<{ ok: true; numero: number } | { ok: false; erro: string }> {
  const u = await exigirAdmin();
  try {
    const venc = dados.vencimento ? new Date(`${dados.vencimento}T12:00:00-03:00`) : undefined;
    const c = await registrarCompra({
      fornecedorId: dados.fornecedorId || null,
      itens: dados.itens.map((i) => ({ produtoId: i.produtoId, quantidade: Math.trunc(Number(i.quantidade)), custoUnitCents: Math.round(Number(i.custoUnitCents)) })),
      notaFiscal: dados.notaFiscal?.trim(),
      observacao: dados.observacao?.trim(),
      pagamento: { status: dados.pago ? "PAGO" : "PENDENTE", vencimento: venc, forma: dados.forma && FORMAS_OK.includes(dados.forma) ? dados.forma : undefined },
      usuario: u.nome,
    });
    revalidatePath("/painel/compras");
    revalidatePath("/painel/estoque");
    revalidatePath("/painel/financeiro");
    return { ok: true, numero: c.numero };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

// ---------------- financeiro ----------------

export async function salvarLancamentoAcao(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirAdmin();
  const tipo = fd.get("tipo") === "RECEITA" ? "RECEITA" : "DESPESA";
  const descricao = String(fd.get("descricao") || "").trim();
  const valor = parseReais(String(fd.get("valor") || ""));
  const venc = String(fd.get("vencimento") || "");
  if (descricao.length < 2) return { erro: "Descreva o lançamento." };
  if (!valor) return { erro: "Informe o valor." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) return { erro: "Informe a data." };
  const pago = fd.get("pago") === "on";
  const forma = String(fd.get("forma") || "") as FormaPagamento;
  const vezes = Math.min(24, Math.max(1, Math.trunc(Number(fd.get("repetir") || 1))));
  const base = new Date(`${venc}T12:00:00-03:00`);
  await db.lancamento.createMany({
    data: Array.from({ length: vezes }, (_, i) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      return {
        tipo,
        descricao: vezes > 1 ? `${descricao} (${i + 1}/${vezes})` : descricao,
        categoria: String(fd.get("categoria") || "").trim() || (tipo === "RECEITA" ? "Outras receitas" : "Outras despesas"),
        valorCents: valor,
        vencimento: d,
        status: pago && i === 0 ? "PAGO" : "PENDENTE",
        pagoEm: pago && i === 0 ? new Date() : null,
        forma: FORMAS_OK.includes(forma) ? forma : null,
        conta: String(fd.get("conta") || "Banco"),
        origem: "MANUAL",
        observacao: String(fd.get("observacao") || "").trim() || null,
        usuario: u.nome,
      };
    }),
  });
  revalidatePath("/painel/financeiro");
  return { ok: vezes > 1 ? `${vezes} lançamentos criados.` : "Lançamento salvo." };
}

export async function baixarLancamentoAcao(id: string, acao: "pagar" | "reabrir" | "cancelar") {
  await exigirAdmin();
  if (acao === "pagar") await db.lancamento.update({ where: { id }, data: { status: "PAGO", pagoEm: new Date() } });
  else if (acao === "reabrir") await db.lancamento.update({ where: { id }, data: { status: "PENDENTE", pagoEm: null } });
  else await db.lancamento.update({ where: { id }, data: { status: "CANCELADO" } });
  revalidatePath("/painel/financeiro");
}

// ---------------- usuários ----------------

export async function salvarUsuarioAcao(_: Estado, fd: FormData): Promise<Estado> {
  const eu = await exigirAdmin();
  const id = String(fd.get("id") || "");
  const nome = String(fd.get("nome") || "").trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const senha = String(fd.get("senha") || "");
  const papel = (fd.get("papel") === "OPERADOR" ? "OPERADOR" : "ADMIN") as Papel;
  if (nome.length < 2) return { erro: "Informe o nome." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: "E-mail inválido." };
  if (!id && senha.length < 6) return { erro: "Senha com pelo menos 6 caracteres." };
  if (id === eu.id && papel !== "ADMIN") return { erro: "Você não pode tirar seu próprio acesso de administrador." };
  const outro = await db.usuario.findUnique({ where: { email } });
  if (outro && outro.id !== id) return { erro: "Já existe um usuário com esse e-mail." };
  const dados = { nome, email, papel, ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}) };
  if (id) await db.usuario.update({ where: { id }, data: dados });
  else await db.usuario.create({ data: { ...dados, senhaHash: dados.senhaHash! } });
  revalidatePath("/painel/usuarios");
  return { ok: "Usuário salvo." };
}

export async function alternarUsuarioAcao(id: string, ativo: boolean) {
  const eu = await exigirAdmin();
  if (id === eu.id) return;
  await db.usuario.update({ where: { id }, data: { ativo } });
  revalidatePath("/painel/usuarios");
}
