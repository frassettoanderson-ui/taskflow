import type { Prisma } from "@prisma/client";
import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Etiquetas } from "./Etiquetas";

export const metadata = { title: "Etiquetas", robots: { index: false } };

const ABAS = { fila: "A imprimir", impressas: "Já impressas", busca: "Buscar produto" } as const;
type Aba = keyof typeof ABAS;

export default async function PaginaEtiquetas({ searchParams }: PageProps<"/painel/etiquetas">) {
  await exigirAdmin();
  const sp = await searchParams;
  const ids = String(sp.ids || "").split(",").filter(Boolean).slice(0, 200);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const aba: Aba = ids.length || q ? "busca" : sp.aba === "impressas" ? "impressas" : sp.aba === "busca" ? "busca" : "fila";

  let where: Prisma.ProdutoWhereInput;
  let orderBy: Prisma.ProdutoOrderByWithRelationInput = { criadoEm: "desc" };
  if (ids.length) where = { id: { in: ids } };
  else if (aba === "fila") where = { etiquetaPendente: true, status: { not: "ARQUIVADO" } };
  else if (aba === "impressas") {
    where = { etiquetaImpressaEm: { not: null } };
    orderBy = { etiquetaImpressaEm: "desc" };
  } else if (q) where = { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { ean: q }, ...(Number(q.replace(/^v/i, "")) ? [{ codigo: Number(q.replace(/^v/i, "")) }] : [])] };
  else where = { id: "__nenhum__" };

  const [produtos, naFila] = await Promise.all([
    db.produto.findMany({
      where,
      select: { id: true, codigo: true, titulo: true, precoCents: true, estoqueDisponivel: true, etiquetaPendente: true, etiquetaImpressaEm: true, cadastradoPor: true, criadoEm: true, fotos: { take: 1, orderBy: { ordem: "asc" }, select: { arquivo: true } } },
      orderBy,
      take: 200,
    }),
    db.produto.count({ where: { etiquetaPendente: true, status: { not: "ARQUIVADO" } } }),
  ]);
  return (
    <Etiquetas
      aba={aba}
      abas={ABAS}
      naFila={naFila}
      busca={q}
      produtos={produtos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        titulo: p.titulo,
        precoCents: p.precoCents,
        estoque: p.estoqueDisponivel,
        foto: p.fotos[0]?.arquivo ?? null,
        pendente: p.etiquetaPendente,
        impressaEm: p.etiquetaImpressaEm?.toISOString() ?? null,
        cadastradoPor: p.cadastradoPor,
        criadoEm: p.criadoEm.toISOString(),
      }))}
    />
  );
}
