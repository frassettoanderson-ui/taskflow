// Dev: sobe Postgres embutido (porta 5433, dados em .pgdata), aplica o schema e inicia o Next na 3100.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import net from "node:net";

const portaEmUso = (porta) =>
  new Promise((r) => {
    const s = net.connect(porta, "127.0.0.1").on("connect", () => { s.end(); r(true); }).on("error", () => r(false));
  });

const PORT_DB = 5433;
const PORT_WEB = 3100;

if (await portaEmUso(PORT_WEB)) {
  console.log(`\n  A Versátil já está rodando: abra http://localhost:${PORT_WEB}\n  (loja) e http://localhost:${PORT_WEB}/painel (painel).\n`);
  process.exit(0);
}

let pg;
if (!(await portaEmUso(PORT_DB))) {
  pg = new EmbeddedPostgres({ databaseDir: "./.pgdata", user: "postgres", password: "postgres", port: PORT_DB, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
  const novo = !existsSync("./.pgdata/PG_VERSION");
  if (novo) await pg.initialise();
  await pg.start();
  if (novo) await pg.createDatabase("versatil");
  console.log("[dev] Postgres embutido rodando na porta", PORT_DB);
}

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
try {
  execSync("npx prisma generate", { stdio: "inherit" });
} catch (e) {
  // no Windows o arquivo do Prisma fica travado se outro processo estiver usando; o client já gerado serve
  if (!existsSync("./node_modules/.prisma/client/index.js")) throw e;
  console.log("[dev] prisma generate pulado (client já existe)");
}
execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });

const next = spawn("npx", ["next", "dev", "-p", String(PORT_WEB)], { stdio: "inherit", shell: true });
const sair = async () => { next.kill(); if (pg) await pg.stop(); process.exit(0); };
process.on("SIGINT", sair);
process.on("SIGTERM", sair);
next.on("exit", sair);
