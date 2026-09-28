import type { Prisma } from "@prisma/client";

export const selecaoCard = {
  id: true,
  slug: true,
  codigo: true,
  titulo: true,
  condicao: true,
  marca: true,
  precoCents: true,
  precoMercadoCents: true,
  estoqueDisponivel: true,
  estoqueReservado: true,
  status: true,
  vendidos: true,
  fotos: { select: { arquivo: true }, orderBy: { ordem: "asc" }, take: 1 },
} satisfies Prisma.ProdutoSelect;

export type ProdutoCard = Prisma.ProdutoGetPayload<{ select: typeof selecaoCard }>;
