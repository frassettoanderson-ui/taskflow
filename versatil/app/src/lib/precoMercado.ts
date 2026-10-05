// Preço de mercado: foto → IA (Gemini) identifica o produto → busca anúncios NOVOS no Mercado Livre
// → tira outliers → mediana → aplica o desconto da loja (padrão 30%) e arredonda para ,90.
// Sem GEMINI_API_KEY: não identifica pela foto (dá para buscar digitando o nome).
// Sem credenciais do Mercado Livre: modo simulação (preços inventados, avisando na tela).
import { db } from "./db";

export type Identificacao = {
  titulo: string;
  marca?: string;
  modelo?: string;
  ean?: string;
  categoria?: string;
  descricao?: string;
  consulta: string; // o que pesquisar no ML
};
export type Anuncio = { titulo: string; precoCents: number; link: string; foto?: string };
export type ResultadoPreco = {
  consulta: string;
  simulado: boolean;
  anuncios: Anuncio[]; // os considerados (sem outliers), ordenados por preço
  descartados: number;
  minCents: number;
  medianaCents: number;
  maxCents: number;
  sugeridoCents: number;
  descontoPct: number;
};

// ---------------- IA: identificar pela foto ----------------

export const iaDisponivel = () => !!process.env.GEMINI_API_KEY;

export async function identificarPorFoto(imagens: { base64: string; mimetype: string }[], categorias: string[]): Promise<Identificacao> {
  if (!iaDisponivel()) throw new Error("IA não configurada (falta GEMINI_API_KEY no servidor). Digite o nome do produto para buscar.");
  const modelo = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `Você é cadastrador de uma loja que vende produtos de logística reversa (caixa aberta, devolução).
Identifique o produto da(s) foto(s). Leia marca, modelo, voltagem, capacidade e código de barras se aparecerem na peça ou na caixa.
Responda SÓ JSON:
{"titulo": "nome comercial curto, como no Mercado Livre (ex.: Air Fryer Philips Walita 4,1L Preta RI9201)",
 "marca": "", "modelo": "", "ean": "só dígitos, se legível",
 "categoria": "uma destas: ${categorias.join(", ")}",
 "descricao": "2 a 3 frases objetivas: o que é, principais características. Não invente acessórios.",
 "consulta": "termo de busca para achar o MESMO produto novo no Mercado Livre: marca + modelo + característica principal, sem palavras como 'novo' ou 'promoção'"}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, ...imagens.slice(0, 3).map((i) => ({ inline_data: { mime_type: i.mimetype, data: i.base64 } }))] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`IA respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const txt: string = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const d = JSON.parse(txt.replace(/^```json|```$/g, "").trim()) as Partial<Identificacao>;
  if (!d.titulo) throw new Error("A IA não reconheceu o produto. Tente uma foto mais próxima da etiqueta ou da caixa.");
  return { ...d, titulo: d.titulo, ean: d.ean?.replace(/\D/g, "") || undefined, consulta: d.consulta || d.titulo };
}

// ---------------- Mercado Livre ----------------

const ML = "https://api.mercadolibre.com";
export const mlConfigurado = () => !!process.env.ML_CLIENT_ID && !!process.env.ML_CLIENT_SECRET;
export const mlRedirectUri = () => process.env.ML_REDIRECT_URI || "https://www.google.com/";
export const mlUrlAutorizacao = () =>
  `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(mlRedirectUri())}`;

let cacheToken: { token: string; expira: number } | null = null;

async function guardarTokens(j: { access_token: string; expires_in: number; refresh_token?: string }) {
  cacheToken = { token: j.access_token, expira: Date.now() + (j.expires_in - 300) * 1000 };
  if (j.refresh_token) await db.config.upsert({ where: { chave: "ml_refresh_token" }, create: { chave: "ml_refresh_token", valor: j.refresh_token }, update: { valor: j.refresh_token } });
}

async function pedirToken(corpo: Record<string, string>) {
  const r = await fetch(`${ML}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: process.env.ML_CLIENT_ID!, client_secret: process.env.ML_CLIENT_SECRET!, ...corpo }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || j.error || `Mercado Livre ${r.status}`);
  return j;
}

/** Troca o código que aparece na URL depois de autorizar (…?code=TG-…) pelo acesso permanente. */
export async function conectarML(codigoOuUrl: string) {
  const code = codigoOuUrl.match(/code=([^&\s]+)/)?.[1] ?? codigoOuUrl.trim();
  await guardarTokens(await pedirToken({ grant_type: "authorization_code", code, redirect_uri: mlRedirectUri() }));
}

export async function mlConectado() {
  return !!(await db.config.findUnique({ where: { chave: "ml_refresh_token" } }))?.valor;
}

async function tokenML(): Promise<string | null> {
  if (cacheToken && cacheToken.expira > Date.now()) return cacheToken.token;
  const refresh = (await db.config.findUnique({ where: { chave: "ml_refresh_token" } }))?.valor;
  if (refresh) {
    await guardarTokens(await pedirToken({ grant_type: "refresh_token", refresh_token: refresh }));
    return cacheToken!.token;
  }
  try {
    await guardarTokens(await pedirToken({ grant_type: "client_credentials" }));
    return cacheToken!.token;
  } catch {
    return null;
  }
}

async function getML<T>(caminho: string, token: string): Promise<{ ok: boolean; status: number; dados: T }> {
  const r = await fetch(`${ML}${caminho}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  return { ok: r.ok, status: r.status, dados: (await r.json().catch(() => ({}))) as T };
}

type ItemBusca = { title: string; price: number; permalink: string; thumbnail?: string; condition?: string };

async function buscarAnunciosML(consulta: string): Promise<Anuncio[]> {
  const token = await tokenML();
  if (!token) throw new Error("Mercado Livre não conectado: abra Configurações → Mercado Livre e clique em Conectar.");
  const q = encodeURIComponent(consulta);
  // 1º: busca de anúncios
  const s = await getML<{ results?: ItemBusca[] }>(`/sites/MLB/search?q=${q}&condition=new&limit=50`, token);
  if (s.ok && s.dados.results?.length)
    return s.dados.results
      .filter((i) => i.price > 0 && (!i.condition || i.condition === "new"))
      .map((i) => ({ titulo: i.title, precoCents: Math.round(i.price * 100), link: i.permalink, foto: i.thumbnail?.replace("http:", "https:") }));
  // 2º (se a busca de anúncios estiver fechada para a aplicação): catálogo → ofertas de cada produto
  const p = await getML<{ results?: { id: string; name: string; pictures?: { url: string }[] }[] }>(`/products/search?status=active&site_id=MLB&q=${q}&limit=5`, token);
  if (!p.ok) throw new Error(`Mercado Livre recusou a busca (${s.status}/${p.status}). Confira as permissões da aplicação.`);
  const anuncios: Anuncio[] = [];
  for (const prod of p.dados.results ?? []) {
    const it = await getML<{ results?: { price: number; condition?: string; item_id: string }[] }>(`/products/${prod.id}/items?limit=20`, token);
    for (const o of it.dados.results ?? [])
      if (o.price > 0 && (!o.condition || o.condition === "new"))
        anuncios.push({ titulo: prod.name, precoCents: Math.round(o.price * 100), link: `https://produto.mercadolivre.com.br/${o.item_id.replace(/^MLB/, "MLB-")}`, foto: prod.pictures?.[0]?.url });
  }
  return anuncios;
}

/** Simulação para testar a tela sem credenciais (preços em torno de um valor derivado do nome). */
function anunciosSimulados(consulta: string): Anuncio[] {
  let h = 0;
  for (const c of consulta) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const base = 8000 + (h % 60000); // R$ 80 a R$ 680
  return Array.from({ length: 12 }, (_, i) => {
    const fator = [0.82, 0.9, 0.94, 0.97, 1, 1, 1.03, 1.06, 1.1, 1.18, 0.3, 2.6][i]; // os 2 últimos são outliers
    return { titulo: `${consulta} (anúncio simulado ${i + 1})`, precoCents: Math.round(base * fator), link: `https://lista.mercadolivre.com.br/${encodeURIComponent(consulta)}` };
  });
}

// ---------------- cálculo ----------------

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Termina o preço em ,90 mantendo os reais (209,30 → 209,90; abaixo de R$ 10 só arredonda os centavos). */
export function arredondar90(cents: number) {
  if (cents < 1000) return Math.max(100, Math.round(cents / 10) * 10);
  return Math.floor(cents / 100) * 100 + 90;
}

export async function pesquisarPreco(consulta: string, opts: { marca?: string; descontoPct: number }): Promise<ResultadoPreco> {
  const simulado = !mlConfigurado();
  let anuncios = simulado ? anunciosSimulados(consulta) : await buscarAnunciosML(consulta);
  if (!anuncios.length) throw new Error(`Nada encontrado no Mercado Livre para “${consulta}”. Ajuste o nome e busque de novo.`);
  // se a IA achou a marca, fica só com anúncios que citam a marca (quando sobram pelo menos 3)
  if (opts.marca) {
    const m = opts.marca.toLowerCase();
    const comMarca = anuncios.filter((a) => a.titulo.toLowerCase().includes(m));
    if (comMarca.length >= 3) anuncios = comMarca;
  }
  // outliers: fora de 45%–220% da mediana bruta (acessórios, kits, preço absurdo)
  const med0 = mediana(anuncios.map((a) => a.precoCents));
  const bons = anuncios.filter((a) => a.precoCents >= med0 * 0.45 && a.precoCents <= med0 * 2.2).sort((a, b) => a.precoCents - b.precoCents);
  const precos = bons.map((a) => a.precoCents);
  const med = mediana(precos);
  return {
    consulta,
    simulado,
    anuncios: bons,
    descartados: anuncios.length - bons.length,
    minCents: precos[0],
    medianaCents: med,
    maxCents: precos[precos.length - 1],
    sugeridoCents: arredondar90(Math.round(med * (1 - opts.descontoPct / 100))),
    descontoPct: opts.descontoPct,
  };
}
