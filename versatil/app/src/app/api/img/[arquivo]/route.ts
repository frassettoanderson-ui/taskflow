import { readFile } from "node:fs/promises";
import path from "node:path";
import { pastaUploads } from "@/lib/uploads";

export async function GET(_: Request, ctx: RouteContext<"/api/img/[arquivo]">) {
  const { arquivo } = await ctx.params;
  if (!/^[a-z0-9]+(-t)?\.webp$/.test(arquivo)) return new Response("não encontrado", { status: 404 });
  try {
    const buf = await readFile(path.join(/*turbopackIgnore: true*/ pastaUploads(), arquivo));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("não encontrado", { status: 404 });
  }
}
