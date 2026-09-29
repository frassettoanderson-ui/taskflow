import { readdir } from "node:fs/promises";
import path from "node:path";
import { pastaUploads } from "./uploads";

export const pastaBanners = () => path.join(pastaUploads(), "banners");

/**
 * Artes do banner principal em UPLOAD_DIR/banners, em ordem de nome:
 *   01.jpg (computador, 1920×500) + 01-mobile.jpg (celular, 1080×660, opcional), 02.jpg…
 */
export async function listarBanners() {
  try {
    const arquivos = (await readdir(pastaBanners())).filter((f) => /^[\w-]+\.(jpe?g|png|webp)$/i.test(f)).sort();
    const desktop = arquivos.filter((f) => !/-mobile\./i.test(f));
    return desktop.map((f) => {
      const base = f.replace(/\.\w+$/, "");
      const mobile = arquivos.find((m) => m.replace(/\.\w+$/, "") === `${base}-mobile`);
      return { arquivo: f, src: `/api/banner/${f}`, srcMobile: mobile ? `/api/banner/${mobile}` : undefined };
    });
  } catch {
    return [];
  }
}
