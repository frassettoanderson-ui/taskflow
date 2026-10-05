import { notFound, redirect } from "next/navigation";
import { acessoCadastro, type DadosRascunho } from "@/lib/cadastroRapido";
import type { ResultadoPreco } from "@/lib/precoMercado";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { Cabecalho } from "../Cabecalho";
import { Conferir } from "./Conferir";
import { AguardarProcessamento } from "./AguardarProcessamento";

export const metadata = { title: "Conferir produto" };

export default async function ConferirCadastro({ params }: PageProps<"/recebimento/[id]">) {
  const a = await acessoCadastro();
  if (!a) redirect("/recebimento/entrar");
  const { id } = await params;
  const r = await db.cadastroRascunho.findUnique({ where: { id } });
  if (!r) notFound();
  if (r.status === "PUBLICADO" && r.produtoId) redirect("/recebimento");
  if (r.status === "DESCARTADO") redirect("/recebimento");
  if (r.status === "PROCESSANDO")
    return (
      <>
        <Cabecalho nome={a.nome} voltar="/recebimento" />
        <AguardarProcessamento />
      </>
    );
  const [categorias, cfg, gruposAtivos] = await Promise.all([
    db.categoria.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    getConfig(),
    db.grupo.count({ where: { ativo: true, presente: true } }),
  ]);
  return (
    <>
      <Cabecalho nome={a.nome} voltar="/recebimento" />
      <Conferir
        key={r.atualizadoEm.getTime()}
        id={r.id}
        fotos={r.fotos}
        ean={r.ean}
        dados={(r.dados ?? {}) as DadosRascunho}
        preco={(r.preco ?? null) as ResultadoPreco | null}
        erro={r.erro}
        categorias={categorias}
        enviarPadrao={cfg.disparo_auto_publicar === "1" && gruposAtivos > 0}
        gruposAtivos={gruposAtivos}
      />
    </>
  );
}
