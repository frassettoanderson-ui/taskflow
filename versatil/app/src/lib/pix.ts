// Pix "copia e cola" estático (BR Code / padrão EMV do Banco Central) com valor, para o QR do balcão.
// Não passa por gateway: o dinheiro cai direto na conta da chave; o operador confirma o recebimento.

const campo = (id: string, valor: string) => id + String(valor.length).padStart(2, "0") + valor;

function crc16(txt: string) {
  let crc = 0xffff;
  for (let i = 0; i < txt.length; i++) {
    crc ^= txt.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const limpar = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, max) || "LOJA";

export function pixCopiaECola(p: { chave: string; nome: string; cidade: string; valorCents: number; txid?: string }) {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", p.chave.trim());
  const txid = (p.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const corpo =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (p.valorCents > 0 ? campo("54", (p.valorCents / 100).toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpar(p.nome, 25)) +
    campo("60", limpar(p.cidade, 15)) +
    campo("62", campo("05", txid)) +
    "6304";
  return corpo + crc16(corpo);
}
