import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pastaUploads } from "./uploads";

export const pastaBanners = () => path.join(pastaUploads(), "banners");

/**
 * Artes do banner principal em UPLOAD_DIR/banners, em ordem de nome:
 *   01.jpg (computador, 1920×500) + 01-mobile.jpg (celular, 1080×660, opcional), 02.jpg…
 * Destino de cada banner (opcional) em links.json: { "01.jpg": "/busca?cat=ferramentas" }.
 */
export async function listarBanners() {
  try {
    const arquivos = (await readdir(pastaBanners())).filter((f) => /^[\w-]+\.(jpe?g|png|webp)$/i.test(f)).sort();
    const desktop = arquivos.filter((f) => !/-mobile\./i.test(f));
    const links: Record<string, string> = await readFile(path.join(pastaBanners(), "links.json"), "utf8")
      .then((t) => JSON.parse(t))
      .catch(() => ({}));
    return desktop.map((f) => {
      const base = f.replace(/\.\w+$/, "");
      const mobile = arquivos.find((m) => m.replace(/\.\w+$/, "") === `${base}-mobile`);
      const href = typeof links[f] === "string" && links[f].startsWith("/") ? links[f] : "/busca?ordem=desconto";
      return { arquivo: f, src: `/api/banner/${f}`, srcMobile: mobile ? `/api/banner/${mobile}` : undefined, href };
    });
  } catch {
    return [];
  }
}
