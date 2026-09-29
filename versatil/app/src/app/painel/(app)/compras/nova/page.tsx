import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormCompra } from "./FormCompra";

export const metadata = { title: "Nova compra" };

export default async function NovaCompra() {
  await exigirAdmin();
  const [produtos, fornecedores] = await Promise.all([
    db.produto.findMany({
      where: { status: { in: ["ATIVO", "ESGOTADO", "RASCUNHO"] } },
      select: { id: true, codigo: true, titulo: true, custoCents: true, estoqueDisponivel: true },
      orderBy: { titulo: "asc" },
      take: 3000,
    }),
    db.fornecedor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold">Entrada de mercadoria</h1>
      <p className="mt-1 text-sm text-cinza">Chegou um lote? Lance aqui: o estoque sobe, o custo médio é recalculado e a conta vai para o financeiro.</p>
      <FormCompra produtos={produtos} fornecedores={fornecedores} />
    </div>
  );
}
