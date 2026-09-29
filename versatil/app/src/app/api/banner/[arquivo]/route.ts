import { readFile } from "node:fs/promises";
import path from "node:path";
import { pastaBanners } from "@/lib/banners";

const TIPOS: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_: Request, ctx: RouteContext<"/api/banner/[arquivo]">) {
  const { arquivo } = await ctx.params;
  const ext = arquivo.split(".").pop()?.toLowerCase() ?? "";
  if (!/^[\w-]+\.(jpe?g|png|webp)$/i.test(arquivo)) return new Response("não encontrado", { status: 404 });
  try {
    const buf = await readFile(path.join(/*turbopackIgnore: true*/ pastaBanners(), arquivo));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": TIPOS[ext], "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("não encontrado", { status: 404 });
  }
}
