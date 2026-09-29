import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Etiquetas } from "./Etiquetas";

export const metadata = { title: "Etiquetas", robots: { index: false } };

export default async function PaginaEtiquetas({ searchParams }: PageProps<"/painel/etiquetas">) {
  await exigirAdmin();
  const ids = String((await searchParams).ids || "").split(",").filter(Boolean).slice(0, 200);
  const produtos = await db.produto.findMany({
    where: ids.length ? { id: { in: ids } } : { status: "ATIVO" },
    select: { id: true, codigo: true, titulo: true, precoCents: true, estoqueDisponivel: true },
    orderBy: { titulo: "asc" },
    take: 200,
  });
  return <Etiquetas produtos={produtos} />;
}
