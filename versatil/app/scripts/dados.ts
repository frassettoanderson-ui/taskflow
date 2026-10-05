// Exporta/importa todos os dados do banco em JSON (serve para levar o banco entre versões diferentes do Postgres).
//   npx tsx scripts/dados.ts exportar dados.json
//   npx tsx scripts/dados.ts importar dados.json   (banco de destino VAZIO, já com o schema aplicado)
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
// ordem respeita as chaves estrangeiras
const TABELAS = [
  "categoria", "usuario", "config", "cliente", "fornecedor", "grupo", "caixaSessao", "produto", "foto",
  "pedido", "itemPedido", "eventoPedido", "pagamentoPedido", "movimentoCaixa", "compra", "compraItem",
  "movimentoEstoque", "lancamento", "disparo", "clique", "cadastroRascunho", "tokenCadastro",
] as const;
type Delegado = { findMany: () => Promise<unknown[]>; createMany: (a: { data: unknown[] }) => Promise<{ count: number }>; count: () => Promise<number> };
const tabela = (t: string) => (db as unknown as Record<string, Delegado>)[t];

async function exportar(arquivo: string) {
  const out: Record<string, unknown[]> = {};
  for (const t of TABELAS) out[t] = await tabela(t).findMany();
  // segredos de integração não viajam
  out.config = (out.config as { chave: string }[]).filter((c) => c.chave !== "ml_refresh_token");
  await writeFile(arquivo, JSON.stringify(out));
  console.log(Object.fromEntries(TABELAS.map((t) => [t, out[t].length])));
}

async function importar(arquivo: string) {
  const dados = JSON.parse(await readFile(arquivo, "utf8")) as Record<string, Record<string, unknown>[]>;
  for (const t of TABELAS) if ((await tabela(t).count()) > 0) throw new Error(`Banco de destino não está vazio (${t}). Abortado.`);
  for (const t of TABELAS) {
    const linhas = (dados[t] ?? []).map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v === null ? undefined : v])));
    for (let i = 0; i < linhas.length; i += 500) await tabela(t).createMany({ data: linhas.slice(i, i + 500) });
    console.log(t, linhas.length);
  }
  // acerta os contadores (código do produto, número do pedido etc.) para continuar depois do maior valor importado
  const seqs = await db.$queryRawUnsafe<{ tabela: string; coluna: string }[]>(
    `SELECT table_name AS tabela, column_name AS coluna FROM information_schema.columns WHERE table_schema = 'public' AND column_default LIKE 'nextval%'`,
  );
  for (const s of seqs)
    await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${s.tabela}"', '${s.coluna}'), COALESCE((SELECT MAX("${s.coluna}") FROM "${s.tabela}"), 0) + 1, false)`);
  console.log("contadores acertados:", seqs.length);
}

const [modo, arquivo = "dados.json"] = process.argv.slice(2);
(modo === "exportar" ? exportar(arquivo) : modo === "importar" ? importar(arquivo) : Promise.reject(new Error("use: exportar|importar <arquivo>")))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
