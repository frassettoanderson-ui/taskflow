// Cliente mínimo da Evolution API (WhatsApp não-oficial — a API oficial da Meta não envia para grupos).
// Sem EVOLUTION_URL => modo demonstração: nada é enviado, os disparos são marcados como simulados.

export const whatsDemo = () => !process.env.EVOLUTION_URL || !process.env.EVOLUTION_API_KEY || !process.env.EVOLUTION_INSTANCE;

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
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${txt.slice(0, 300)}`);
  return (txt ? JSON.parse(txt) : {}) as T;
}

const inst = () => encodeURIComponent(process.env.EVOLUTION_INSTANCE!);

export async function estadoConexao(): Promise<"demo" | "open" | "close" | "connecting" | "erro"> {
  if (whatsDemo()) return "demo";
  try {
    const r = await req<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${inst()}`);
    return (r.instance?.state as "open" | "close" | "connecting") ?? "erro";
  } catch {
    return "erro";
  }
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
