// Fila de disparo nos grupos. Um worker (instrumentation.ts) chama processarFila() a cada 10s e envia
// no máximo UMA mensagem por vez, respeitando: intervalo aleatório entre envios, intervalo mínimo por
// grupo, teto por hora e janela de horário. O texto é montado na hora do envio (preço/estoque atuais).
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { TipoDisparo } from "@prisma/client";
import { db } from "./db";
import { getConfig } from "./config";
import { montarMensagem } from "./mensagem";
import { enviarImagem, estadoConexao, listarGrupos, whatsDemo } from "./evolution";
import { pastaUploads } from "./uploads";

const urlPublica = () => (process.env.PUBLIC_URL || "http://localhost:3100").replace(/\/$/, "");
export const linkProduto = (slug: string, grupoNumero?: number) => `${urlPublica()}/p/${slug}${grupoNumero ? `?g=${grupoNumero}` : ""}`;

/** Coloca o produto na fila de todos os grupos ativos. Não duplica se já houver pendente para o mesmo grupo. */
export async function enfileirar(produtoId: string, tipo: TipoDisparo = "NOVO") {
  const grupos = await db.grupo.findMany({ where: { ativo: true, presente: true }, select: { id: true } });
  if (!grupos.length) return 0;
  const jaNaFila = new Set(
    (await db.disparo.findMany({ where: { produtoId, status: { in: ["PENDENTE", "ENVIANDO"] } }, select: { grupoId: true } })).map((d) => d.grupoId),
  );
  const novos = grupos.filter((g) => !jaNaFila.has(g.id));
  if (!novos.length) return 0;
  await db.disparo.createMany({ data: novos.map((g) => ({ produtoId, grupoId: g.id, tipo })) });
  return novos.length;
}

export async function cancelarPendentes(produtoId: string, motivo: string) {
  const r = await db.disparo.updateMany({ where: { produtoId, status: "PENDENTE" }, data: { status: "CANCELADO", erro: motivo } });
  return r.count;
}

async function imagemParaEnvio(arquivo?: string) {
  if (!arquivo) return null;
  try {
    const buf = await readFile(path.join(/*turbopackIgnore: true*/ pastaUploads(), `${arquivo}.webp`));
    const jpg = await sharp(buf).jpeg({ quality: 85 }).toBuffer(); // WhatsApp trata webp como figurinha
    return { base64: jpg.toString("base64"), mimetype: "image/jpeg" };
  } catch {
    return null;
  }
}

const horaBRT = () => new Date(Date.now() - 3 * 3600_000).getUTCHours();
const aleatorio = (min: number, max: number) => min + Math.random() * Math.max(0, max - min);

let rodando = false;

export async function processarFila(): Promise<string> {
  if (rodando) return "ocupado";
  rodando = true;
  try {
    const cfg = await getConfig();
    if (cfg.disparo_ativo !== "1") return "pausado";
    const h = horaBRT();
    if (h < Number(cfg.disparo_hora_inicio) || h >= Number(cfg.disparo_hora_fim)) return "fora do horário";
    const proximo = (await db.config.findUnique({ where: { chave: "disparo_proximo" } }))?.valor;
    if (proximo && Date.now() < new Date(proximo).getTime()) return "aguardando intervalo";
    const ultimaHora = await db.disparo.count({ where: { status: "ENVIADO", enviadoEm: { gte: new Date(Date.now() - 3600_000) } } });
    if (ultimaHora >= Number(cfg.disparo_limite_hora)) return "limite por hora";

    const candidatos = await db.disparo.findMany({
      where: { status: "PENDENTE", agendadoPara: { lte: new Date() } },
      orderBy: [{ agendadoPara: "asc" }, { criadoEm: "asc" }],
      take: 100,
      include: { grupo: true },
    });
    if (!candidatos.length) return "fila vazia";
    // número caiu/desconectou: segura a fila (não queima os envios como falha)
    if (!whatsDemo() && (await estadoConexao()) !== "open") return "whatsapp desconectado";

    const gapMs = Number(cfg.disparo_intervalo_grupo_min) * 60_000;
    const ultimos = await db.disparo.groupBy({
      by: ["grupoId"],
      where: { status: "ENVIADO", grupoId: { in: [...new Set(candidatos.map((c) => c.grupoId))] } },
      _max: { enviadoEm: true },
    });
    const ultimoPorGrupo = new Map(ultimos.map((u) => [u.grupoId, u._max.enviadoEm?.getTime() ?? 0]));

    let escolhido: (typeof candidatos)[number] | undefined;
    for (const c of candidatos) {
      if (!c.grupo.ativo || !c.grupo.presente) {
        await db.disparo.update({ where: { id: c.id }, data: { status: "CANCELADO", erro: "grupo desativado" } });
        continue;
      }
      if (Date.now() - (ultimoPorGrupo.get(c.grupoId) ?? 0) >= gapMs) {
        escolhido = c;
        break;
      }
    }
    if (!escolhido) return "aguardando intervalo por grupo";

    const cas = await db.disparo.updateMany({ where: { id: escolhido.id, status: "PENDENTE" }, data: { status: "ENVIANDO" } });
    if (!cas.count) return "concorrência";

    const produto = await db.produto.findUnique({
      where: { id: escolhido.produtoId },
      include: { fotos: { orderBy: { ordem: "asc" }, take: 1 } },
    });
    if (!produto || produto.status !== "ATIVO" || produto.estoqueDisponivel <= 0) {
      await db.disparo.update({ where: { id: escolhido.id }, data: { status: "CANCELADO", erro: "produto vendido/indisponível antes do envio" } });
      return "cancelado: indisponível";
    }

    const texto = montarMensagem(produto, linkProduto(produto.slug, escolhido.grupo.numero), escolhido.tipo, `${produto.id}:${escolhido.grupoId}:${escolhido.tipo}`);
    try {
      const r = await enviarImagem(escolhido.grupo.jid, texto, await imagemParaEnvio(produto.fotos[0]?.arquivo));
      await db.disparo.update({
        where: { id: escolhido.id },
        data: { status: "ENVIADO", enviadoEm: new Date(), texto, erro: r.simulado ? "simulado (modo demonstração)" : null, tentativas: { increment: 1 } },
      });
    } catch (e) {
      const tentativas = escolhido.tentativas + 1;
      await db.disparo.update({
        where: { id: escolhido.id },
        data: {
          status: tentativas >= 3 ? "FALHOU" : "PENDENTE",
          agendadoPara: new Date(Date.now() + 5 * 60_000),
          tentativas,
          erro: (e as Error).message.slice(0, 500),
        },
      });
    }
    const espera = aleatorio(Number(cfg.disparo_intervalo_min), Number(cfg.disparo_intervalo_max)) * 1000;
    await db.config.upsert({
      where: { chave: "disparo_proximo" },
      create: { chave: "disparo_proximo", valor: new Date(Date.now() + espera).toISOString() },
      update: { valor: new Date(Date.now() + espera).toISOString() },
    });
    return "enviado";
  } finally {
    rodando = false;
  }
}

/** Busca os grupos do número conectado. No modo demonstração cria 3 grupos de teste. */
export async function sincronizarGrupos() {
  if (whatsDemo()) {
    const existentes = await db.grupo.count();
    if (!existentes)
      for (const [i, nome] of ["L3 Ofertas 1 (teste)", "L3 Ofertas 2 (teste)", "Achadinhos da Região (teste)"].entries())
        await db.grupo.create({ data: { jid: `demo-${i + 1}@g.us`, nome, participantes: 180 + i * 57, ativo: true } });
    return { total: await db.grupo.count(), novos: existentes ? 0 : 3 };
  }
  const grupos = await listarGrupos();
  let novos = 0;
  // grupos em que o número não está mais (e os de teste do modo demonstração) saem da lista
  await db.grupo.updateMany({ where: { jid: { notIn: grupos.map((g) => g.jid) } }, data: { presente: false, ativo: false } });
  for (const g of grupos) {
    const ex = await db.grupo.findUnique({ where: { jid: g.jid } });
    if (ex) await db.grupo.update({ where: { id: ex.id }, data: { nome: g.nome, participantes: g.participantes ?? ex.participantes, presente: true } });
    else {
      await db.grupo.create({ data: { jid: g.jid, nome: g.nome, participantes: g.participantes, ativo: false } });
      novos++;
    }
  }
  return { total: grupos.length, novos };
}
