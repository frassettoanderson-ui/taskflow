import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { FormProduto } from "../FormProduto";
import { exigirAdmin } from "@/lib/auth";

export default async function NovoProduto() {
  await exigirAdmin();
  const categorias = await db.categoria.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } });
  return (
    <>
      <h1 className="mb-5 text-center text-2xl font-extrabold">Cadastrar produto</h1>
      <FormProduto categorias={categorias} gruposAtivos={await db.grupo.count({ where: { ativo: true } })} autoDisparo={(await getConfig()).disparo_auto_publicar === "1"} />
    </>
  );
}
