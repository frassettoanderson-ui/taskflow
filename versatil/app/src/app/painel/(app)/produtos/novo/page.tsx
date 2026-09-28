import { db } from "@/lib/db";
import { FormProduto } from "../FormProduto";

export default async function NovoProduto() {
  const categorias = await db.categoria.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } });
  return (
    <>
      <h1 className="mb-5 text-center text-2xl font-extrabold">Cadastrar produto</h1>
      <FormProduto categorias={categorias} />
    </>
  );
}
