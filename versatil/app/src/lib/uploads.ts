import sharp from "sharp";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const pastaUploads = () => path.resolve(process.env.UPLOAD_DIR || "./uploads");

/** Salva foto como WebP (1400px) + miniatura (480px). Retorna o nome base. */
export async function salvarFoto(buf: Buffer) {
  await mkdir(pastaUploads(), { recursive: true });
  const nome = Date.now().toString(36) + randomBytes(4).toString("hex");
  const img = sharp(buf, { failOn: "none" }).rotate();
  await writeFile(path.join(pastaUploads(), `${nome}.webp`), await img.clone().resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer());
  await writeFile(path.join(pastaUploads(), `${nome}-t.webp`), await img.clone().resize(480, 480, { fit: "cover" }).webp({ quality: 72 }).toBuffer());
  return nome;
}

export async function apagarFoto(nome: string) {
  for (const f of [`${nome}.webp`, `${nome}-t.webp`]) await unlink(path.join(pastaUploads(), f)).catch(() => {});
}

export { urlFoto } from "./uploads-url";
