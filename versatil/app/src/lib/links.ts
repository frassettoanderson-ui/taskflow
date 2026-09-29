import { soDigitos } from "./format";

type Cfg = { loja_whatsapp: string; loja_grupo_whatsapp: string };

export function linkWhats(cfg: Cfg, mensagem: string) {
  const zap = soDigitos(cfg.loja_whatsapp);
  return zap ? `https://wa.me/55${zap}?text=${encodeURIComponent(mensagem)}` : null;
}

/** Link do grupo de ofertas; sem grupo configurado, cai numa conversa pedindo para entrar. */
export function linkGrupo(cfg: Cfg) {
  const g = cfg.loja_grupo_whatsapp.trim();
  if (/^https:\/\/(chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com)\//.test(g)) return g;
  return linkWhats(cfg, "Olá! Quero entrar no grupo de ofertas da Versátil.");
}

/**
 * Destinos aceitos nos banners (links.json):
 *   "/busca?cat=x"          página da loja
 *   "@grupo"                grupo de ofertas do WhatsApp
 *   "@whats:mensagem"       conversa com a loja já com a mensagem
 *   ""                      sem link
 */
export function resolverLink(destino: string | undefined, cfg: Cfg): string | null {
  if (destino === undefined) return "/busca?ordem=desconto";
  if (!destino) return null;
  if (destino === "@grupo") return linkGrupo(cfg);
  if (destino.startsWith("@whats")) return linkWhats(cfg, destino.split(":").slice(1).join(":") || "Olá! Vim pelo site da Versátil.");
  return destino.startsWith("/") && !destino.startsWith("//") ? destino : null;
}
