import { db } from "@/lib/db";
import { selecaoCard } from "@/lib/catalogo";

/** Dados dos cards personalizados da home a partir do histórico do navegador (?vistos=id1,id2,...). */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("vistos") || "").split(",").filter((s) => /^[a-z0-9]{10,40}$/.test(s)).slice(0, 20);
  if (!ids.length) return Response.json({ visto: null, interessa: null });

  const vistos = await db.produto.findMany({ where: { id: { in: ids }, status: "ATIVO" }, select: { ...selecaoCard, categoriaId: true } });
  const ordenados = ids.map((id) => vistos.find((v) => v.id === id)).filter((v): v is (typeof vistos)[number] => Boolean(v));
  const visto = ordenados[0] ?? null;

  // "também te interessa": mesma categoria do último visto, que a pessoa ainda não viu
  const base = await db.produto.findUnique({ where: { id: ids[0] }, select: { categoriaId: true } });
  const interessa =
    (await db.produto.findFirst({
      where: { status: "ATIVO", id: { notIn: ids }, ...(base?.categoriaId ? { categoriaId: base.categoriaId } : {}) },
      select: selecaoCard,
      orderBy: { publicadoEm: "desc" },
    })) ?? (await db.produto.findFirst({ where: { status: "ATIVO", id: { notIn: ids } }, select: selecaoCard, orderBy: { visualizacoes: "desc" } }));

  return Response.json({ visto, interessa }, { headers: { "Cache-Control": "no-store" } });
}
