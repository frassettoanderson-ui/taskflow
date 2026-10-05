import { redirect } from "next/navigation";
import { acessoCadastro } from "@/lib/cadastroRapido";
import { db } from "@/lib/db";
import { Cabecalho } from "../Cabecalho";
import { Captura } from "./Captura";

export const metadata = { title: "Fotografar" };

export default async function NovoCadastro({ searchParams }: PageProps<"/recebimento/novo">) {
  const a = await acessoCadastro();
  if (!a) redirect("/recebimento/entrar");
  const ok = (await searchParams).ok;
  const naFila = await db.cadastroRascunho.count({ where: { status: { in: ["PROCESSANDO", "PRONTO", "ERRO"] } } });
  return (
    <>
      <Cabecalho nome={a.nome} voltar="/recebimento" />
      {typeof ok === "string" && <p className="mx-4 mt-3 rounded-xl bg-jade/10 px-3 py-2 text-center text-sm text-jade">✓ {ok}</p>}
      <Captura naFila={naFila} />
    </>
  );
}
