import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

// Divide um PDF multipaginas em buffers de 1 pagina cada (pdf-lib).
// Se houver 1 pagina ou falhar, retorna o proprio buffer.
export async function dividirPaginas(buffer: Buffer): Promise<Buffer[]> {
  try {
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const total = src.getPageCount();
    if (total <= 1) return [buffer];
    const paginas: Buffer[] = [];
    for (let i = 0; i < total; i++) {
      const novo = await PDFDocument.create();
      const [page] = await novo.copyPages(src, [i]);
      novo.addPage(page);
      const bytes = await novo.save();
      paginas.push(Buffer.from(bytes));
    }
    return paginas;
  } catch {
    return [buffer];
  }
}

export interface ResultadoExtracao {
  texto: string;
  metodo: 'PDF_TEXTO' | 'OCR' | 'VAZIO';
}

// Extrai texto de um PDF. Tenta pdf-parse; se vazio (escaneado), tenta OCR.
export async function extrairTexto(buffer: Buffer): Promise<ResultadoExtracao> {
  let texto = '';
  try {
    const r = await pdfParse(buffer);
    texto = (r.text ?? '').trim();
  } catch {
    texto = '';
  }
  if (texto.length >= 10) return { texto, metodo: 'PDF_TEXTO' };

  // Fallback OCR (PDF escaneado). Requer rasterizacao da pagina em imagem.
  // A rasterizacao depende de ambiente (pdftoppm/poppler ou pdfjs+canvas);
  // quando disponivel, plugar aqui. Por ora sinalizamos para revisao manual.
  const ocr = await tentarOcr(buffer);
  if (ocr && ocr.length >= 10) return { texto: ocr, metodo: 'OCR' };

  return { texto, metodo: 'VAZIO' };
}

// OCR via Tesseract.js (lazy). Atualmente so opera se receber uma imagem;
// PDFs escaneados precisam ser rasterizados antes (ver nota acima).
async function tentarOcr(_buffer: Buffer): Promise<string | null> {
  // Placeholder seguro: nao quebra o deploy. Para ativar o OCR de PDFs
  // escaneados, rasterizar cada pagina e chamar Tesseract.recognize(imagem).
  return null;
}

// Normaliza texto para busca de digitos (identificadores).
export function digitosDoTexto(texto: string): string {
  return texto.replace(/\D/g, '');
}
