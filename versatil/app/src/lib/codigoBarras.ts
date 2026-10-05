// Lê código de barras (EAN/UPC) das fotos no servidor — funciona com qualquer celular, inclusive iPhone.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

let pronto: Promise<void> | null = null;
function preparar() {
  pronto ??= (async () => {
    const wasm = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm"));
    prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer }, fireImmediately: true });
  })();
  return pronto;
}

/** Dígito verificador do EAN-8/12/13/14. */
export function eanValido(c: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false;
  const d = c.split("").map(Number);
  const dv = d.pop()!;
  const soma = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
}

/** Primeiro EAN/UPC válido encontrado nas imagens (na ordem recebida). */
export async function lerCodigoBarras(imagens: Buffer[]): Promise<string | undefined> {
  await preparar();
  for (const img of imagens) {
    try {
      // o leitor não entende WebP: converte para PNG em tons de cinza (mantém resolução)
      const png = await sharp(img, { failOn: "none" }).rotate().grayscale().png().toBuffer();
      const r = await readBarcodes(new Uint8Array(png), { formats: ["EAN-13", "EAN-8", "UPC-A", "UPC-E"], tryHarder: true, maxNumberOfSymbols: 3 });
      const ok = r.map((x) => x.text.replace(/\D/g, "")).find(eanValido);
      if (ok) return ok;
    } catch {}
  }
  return undefined;
}
