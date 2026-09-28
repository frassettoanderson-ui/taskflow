// Dev: sobe Postgres embutido (porta 5433, dados em .pgdata), aplica o schema e inicia o Next na 3100.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import net from "node:net";

const PORT = 5433;
const emUso = await new Promise((r) => {
  const s = net.connect(PORT, "127.0.0.1").on("connect", () => { s.end(); r(true); }).on("error", () => r(false));
});

let pg;
if (!emUso) {
  pg = new EmbeddedPostgres({ databaseDir: "./.pgdata", user: "postgres", password: "postgres", port: PORT, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
  const novo = !existsSync("./.pgdata/PG_VERSION");
  if (novo) await pg.initialise();
  await pg.start();
  if (novo) await pg.createDatabase("versatil");
  console.log("[dev] Postgres embutido rodando na porta", PORT);
}

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
execSync("npx prisma generate", { stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });

const next = spawn("npx", ["next", "dev", "-p", "3100"], { stdio: "inherit", shell: true });
const sair = async () => { next.kill(); if (pg) await pg.stop(); process.exit(0); };
process.on("SIGINT", sair);
process.on("SIGTERM", sair);
next.on("exit", sair);
