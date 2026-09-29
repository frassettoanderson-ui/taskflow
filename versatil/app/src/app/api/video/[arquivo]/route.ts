import { open, stat } from "node:fs/promises";
import path from "node:path";
import { pastaVideos } from "@/lib/uploads";

/** Serve os vídeos de produto com suporte a Range (obrigatório para o Safari/iPhone tocar). */
export async function GET(req: Request, ctx: RouteContext<"/api/video/[arquivo]">) {
  const { arquivo } = await ctx.params;
  if (!/^[a-z0-9]+\.(mp4|webm|mov)$/.test(arquivo)) return new Response("não encontrado", { status: 404 });
  const caminho = path.join(/*turbopackIgnore: true*/ pastaVideos(), arquivo);
  let tamanho: number;
  try {
    tamanho = (await stat(caminho)).size;
  } catch {
    return new Response("não encontrado", { status: 404 });
  }
  const tipo = arquivo.endsWith(".webm") ? "video/webm" : arquivo.endsWith(".mov") ? "video/quicktime" : "video/mp4";
  const range = req.headers.get("range");
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  const ini = m && m[1] ? Number(m[1]) : 0;
  const fim = m && m[2] ? Math.min(Number(m[2]), tamanho - 1) : Math.min(ini + 2_000_000, tamanho - 1);
  if (m && ini >= tamanho) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${tamanho}` } });
  const fh = await open(caminho, "r");
  const inicio = m ? ini : 0;
  const final = m ? fim : tamanho - 1;
  const buf = Buffer.alloc(final - inicio + 1);
  await fh.read(buf, 0, buf.length, inicio);
  await fh.close();
  return new Response(new Uint8Array(buf), {
    status: m ? 206 : 200,
    headers: {
      "Content-Type": tipo,
      "Content-Length": String(buf.length),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
      ...(m ? { "Content-Range": `bytes ${inicio}-${final}/${tamanho}` } : {}),
    },
  });
}
