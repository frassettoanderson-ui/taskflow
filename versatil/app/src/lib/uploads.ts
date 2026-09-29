import sharp from "sharp";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const pastaUploads = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");

/** Salva foto como WebP (1400px) + miniatura (480px). Retorna o nome base. */
export async function salvarFoto(buf: Buffer) {
  await mkdir(pastaUploads(), { recursive: true });
  const nome = Date.now().toString(36) + randomBytes(4).toString("hex");
  const img = sharp(buf, { failOn: "none" }).rotate();
  await writeFile(path.join(/*turbopackIgnore: true*/ pastaUploads(), `${nome}.webp`), await img.clone().resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer());
  await writeFile(path.join(/*turbopackIgnore: true*/ pastaUploads(), `${nome}-t.webp`), await img.clone().resize(480, 480, { fit: "cover" }).webp({ quality: 72 }).toBuffer());
  return nome;
}

export const pastaVideos = () => path.join(/*turbopackIgnore: true*/ pastaUploads(), "videos");

/** Salva o vídeo do produto como veio (mp4/webm/mov). Retorna a URL pública. */
export async function salvarVideo(buf: Buffer, nomeOriginal: string) {
  await mkdir(pastaVideos(), { recursive: true });
  const ext = (nomeOriginal.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const extOk = ["mp4", "webm", "mov"].includes(ext) ? ext : "mp4";
  const nome = Date.now().toString(36) + randomBytes(4).toString("hex") + "." + extOk;
  await writeFile(path.join(/*turbopackIgnore: true*/ pastaVideos(), nome), buf);
  return `/api/video/${nome}`;
}

export async function apagarVideo(url: string | null | undefined) {
  const m = url && /^\/api\/video\/([a-z0-9]+\.(mp4|webm|mov))$/.exec(url);
  if (m) await unlink(path.join(/*turbopackIgnore: true*/ pastaVideos(), m[1])).catch(() => {});
}

export async function apagarFoto(nome: string) {
  for (const f of [`${nome}.webp`, `${nome}-t.webp`]) await unlink(path.join(/*turbopackIgnore: true*/ pastaUploads(), f)).catch(() => {});
}

export { urlFoto } from "./uploads-url";
