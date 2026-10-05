"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/auth";

/** Depois de imprimir: tira da fila "A imprimir" e registra quando saiu. */
export async function marcarImpressasAcao(ids: string[]) {
  await exigirAdmin();
  await db.produto.updateMany({ where: { id: { in: ids.slice(0, 500) } }, data: { etiquetaPendente: false, etiquetaImpressaEm: new Date() } });
  revalidatePath("/painel/etiquetas");
}
