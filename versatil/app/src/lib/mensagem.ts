// Monta a mensagem do produto no mesmo estilo que a loja já usa nos grupos,
// com variações de abertura/chamada para que nenhum grupo receba textos idênticos em série
// (mensagens iguais repetidas são o principal motivo de restrição do número).
import { brl, CONDICOES, descontoPct } from "./format";

type P = {
  titulo: string;
  slug: string;
  precoCents: number;
  precoMercadoCents: number | null;
  condicao: string;
  marca: string | null;
  sku: string | null;
  aplicacao: string;
  estoqueDisponivel: number;
};

const ABERTURA = {
  NOVO: ["🔥 {t} 🔥", "🆕 Chegou: *{t}*", "📦 Novidade na loja: *{t}*", "⚡ *{t}*", "✨ Acabou de chegar: *{t}*"],
  PROMOCAO: ["⬇️ *BAIXOU!* {t}", "💥 Preço caiu: *{t}*", "🔥 Promoção relâmpago: *{t}*", "📉 Novo preço: *{t}*"],
  REENVIO: ["🔁 Ainda disponível: *{t}*", "👀 Ainda dá tempo: *{t}*", "🔥 {t} 🔥", "📦 Segue disponível: *{t}*"],
};
const CHAMADA = ["🛒 Compre pelo link:", "👉 Garanta o seu aqui:", "🛍️ Link para comprar:", "📲 Pague no Pix ou cartão:", "🔗 Compre agora:"];
const FECHO = ["Retire na loja 😉", "Pagamento no Pix ou cartão, retirada na loja.", "Quem comprar primeiro leva!", "", "Pagou, reservou. Retire quando quiser."];

// escolha determinística por semente (produto+grupo+tipo) => textos diferentes entre grupos
function escolher<T>(lista: T[], semente: string, sal: number) {
  let h = 2166136261 ^ sal;
  for (const c of semente) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return lista[Math.abs(h) % lista.length];
}

export function montarMensagem(p: P, link: string, tipo: "NOVO" | "PROMOCAO" | "REENVIO", semente: string) {
  const l: string[] = [];
  l.push(escolher(ABERTURA[tipo], semente, 1).replace("{t}", p.titulo));
  l.push("");
  const desc = descontoPct(p.precoCents, p.precoMercadoCents);
  if (desc > 0 && p.precoMercadoCents) l.push(`💰 De ~${brl(p.precoMercadoCents)}~ por *${brl(p.precoCents)}* (${desc}% off)`);
  else l.push(`💰 *${brl(p.precoCents)}*`);
  l.push(`📦 ${CONDICOES[p.condicao]?.rotulo ?? ""}`);

  const aplic = p.aplicacao.split("\n").map((s) => s.trim()).filter(Boolean);
  const specs = [...aplic];
  if (p.marca) specs.push(`Marca: ${p.marca}`);
  if (p.sku) specs.push(`Código/SKU: ${p.sku}`);
  if (specs.length) {
    l.push("");
    if (aplic.length) l.push("✅ Aplicação / compatibilidade:");
    for (const s of specs) l.push(`✔️ ${s}`);
  }
  if (p.estoqueDisponivel === 1) {
    l.push("");
    l.push("⚠️ Última unidade!");
  }
  l.push("");
  l.push(escolher(CHAMADA, semente, 2));
  l.push(link);
  const fecho = escolher(FECHO, semente, 3);
  if (fecho) {
    l.push("");
    l.push(fecho);
  }
  return l.join("\n");
}
