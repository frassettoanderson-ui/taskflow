import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { codigoInterno } from "@/components/CardProduto";
import { FormProduto } from "../FormProduto";

export default async function EditarProduto({ params }: PageProps<"/painel/produtos/[id]">) {
  const { id } = await params;
  const [produto, categorias] = await Promise.all([
    db.produto.findUnique({ where: { id }, include: { fotos: { orderBy: { ordem: "asc" }, select: { id: true, arquivo: true } } } }),
    db.categoria.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!produto) notFound();
  return (
    <>
      <p className="text-center font-mono text-xs tracking-wider text-ouro">Código interno {codigoInterno(produto.codigo)}</p>
      <h1 className="mb-5 text-center text-2xl font-extrabold">Editar produto</h1>
      <FormProduto key={produto.atualizadoEm.toISOString()} produto={produto} categorias={categorias} gruposAtivos={await db.grupo.count({ where: { ativo: true } })} autoDisparo={false} />
    </>
  );
}
