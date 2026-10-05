// Uso no navegador.
/** Reduz a foto no próprio celular antes de enviar (upload rápido no 4G). */
export async function comprimir(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size < 400_000) return f;
  try {
    const bmp = await createImageBitmap(f);
    const esc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * esc);
    c.height = Math.round(bmp.height * esc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
    return new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return f;
  }
}
