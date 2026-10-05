// Cliente mínimo da Evolution API (WhatsApp não-oficial — a API oficial da Meta não envia para grupos).
// Sem EVOLUTION_URL/EVOLUTION_API_KEY => modo demonstração: nada é enviado, os disparos são marcados como simulados.
// A instância (EVOLUTION_INSTANCE, padrão "L3 salvados") é criada pelo próprio painel na hora de conectar o número.

export const whatsDemo = () => !process.env.EVOLUTION_URL || !process.env.EVOLUTION_API_KEY;

class ErroEvolution extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

async function req<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const url = process.env.EVOLUTION_URL!.replace(/\/$/, "") + caminho;
  const r = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY! },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new ErroEvolution(r.status, `Evolution ${r.status}: ${txt.slice(0, 300)}`);
  return (txt ? JSON.parse(txt) : {}) as T;
}

const nomeInstancia = () => process.env.EVOLUTION_INSTANCE || "L3 salvados";
const inst = () => encodeURIComponent(nomeInstancia());

export type EstadoWhats = "demo" | "open" | "close" | "connecting" | "sem_instancia" | "erro";

export async function estadoConexao(): Promise<EstadoWhats> {
  if (whatsDemo()) return "demo";
  try {
    const r = await req<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${inst()}`);
    const s = r.instance?.state;
    return s === "open" || s === "connecting" ? s : "close";
  } catch (e) {
    return e instanceof ErroEvolution && e.status === 404 ? "sem_instancia" : "erro";
  }
}

/** Número e nome do perfil conectado (quando houver). Aceita o formato da Evolution v1 e v2. */
export async function perfilConectado(): Promise<{ numero?: string; nome?: string; foto?: string } | null> {
  if (whatsDemo()) return null;
  try {
    const r = await req<Record<string, unknown>[]>("GET", `/instance/fetchInstances?instanceName=${inst()}`);
    const i = (r[0]?.instance as Record<string, unknown>) ?? r[0];
    if (!i) return null;
    const jid = String(i.ownerJid ?? i.owner ?? "");
    return { numero: jid.split("@")[0] || undefined, nome: (i.profileName as string) || undefined, foto: (i.profilePicUrl as string) || undefined };
  } catch {
    return null;
  }
}

/** Gera o QR Code para parear o número (cria a instância se ainda não existir). Devolve data URL da imagem. */
export async function gerarQrCode(): Promise<{ qr?: string; codigo?: string; conectado?: boolean }> {
  if (whatsDemo()) throw new Error("Evolution não configurada no servidor (EVOLUTION_URL / EVOLUTION_API_KEY).");
  const estado = await estadoConexao();
  if (estado === "open") return { conectado: true };
  if (estado === "sem_instancia") {
    const r = await req<{ qrcode?: { base64?: string; pairingCode?: string } }>("POST", "/instance/create", {
      instanceName: nomeInstancia(),
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      groupsIgnore: true, // só publica: não precisa receber as mensagens dos grupos
      rejectCall: true,
      alwaysOnline: false,
      readMessages: false,
    });
    if (r.qrcode?.base64) return { qr: r.qrcode.base64, codigo: r.qrcode.pairingCode };
  }
  const r = await req<{ base64?: string; pairingCode?: string; qrcode?: { base64?: string } }>("GET", `/instance/connect/${inst()}`);
  const qr = r.base64 ?? r.qrcode?.base64;
  if (!qr) return (await estadoConexao()) === "open" ? { conectado: true } : {};
  return { qr: qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`, codigo: r.pairingCode };
}

/** Desconecta o número (logout). A instância continua lá para conectar outro número depois. */
export async function desconectar() {
  if (whatsDemo()) return;
  await req("DELETE", `/instance/logout/${inst()}`);
}

export async function listarGrupos(): Promise<{ jid: string; nome: string; participantes?: number }[]> {
  if (whatsDemo()) return [];
  const r = await req<{ id: string; subject: string; size?: number }[]>("GET", `/group/fetchAllGroups/${inst()}?getParticipants=false`);
  return r.map((g) => ({ jid: g.id, nome: g.subject || g.id, participantes: g.size }));
}

export async function enviarImagem(jid: string, legenda: string, imagem?: { base64: string; mimetype: string } | null) {
  if (whatsDemo()) return { simulado: true };
  if (!imagem) {
    await req("POST", `/message/sendText/${inst()}`, { number: jid, text: legenda });
  } else {
    await req("POST", `/message/sendMedia/${inst()}`, {
      number: jid,
      mediatype: "image",
      mimetype: imagem.mimetype,
      caption: legenda,
      media: imagem.base64,
      fileName: "produto.jpg",
    });
  }
  return { simulado: false };
}
