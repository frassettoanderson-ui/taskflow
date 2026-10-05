// Preço de mercado + dados do produto: foto → IA (Gemini) identifica → Mercado Livre (pelo código de barras
// quando houver, senão pelo nome) → anúncios NOVOS, tira outliers, mediana − desconto da loja (terminando em ,90)
// + ficha técnica do catálogo do ML → IA redige a descrição com esses dados (texto próprio, sem copiar anunciantes).
// Sem GEMINI_API_KEY: não identifica pela foto. Sem credenciais do ML: modo simulação (avisa na tela).
import { db } from "./db";

export type Identificacao = {
  titulo: string;
  marca?: string;
  modelo?: string;
  ean?: string;
  categoria?: string;
  descricao?: string; // o que a IA viu nas fotos
  consulta: string; // o que pesquisar no ML
};
export type Anuncio = { titulo: string; precoCents: number; link: string; foto?: string };
export type FichaItem = { nome: string; valor: string };
export type Catalogo = { nome?: string; ficha: FichaItem[]; destaques: string[] };
export type ResultadoPreco = {
  consulta: string;
  porCodigoBarras: boolean;
  simulado: boolean;
  anuncios: Anuncio[]; // os considerados (sem outliers), ordenados por preço
  descartados: number;
  minCents: number;
  medianaCents: number;
  maxCents: number;
  sugeridoCents: number;
  descontoPct: number;
  catalogo?: Catalogo;
};

// ---------------- IA (Gemini) ----------------

export const iaDisponivel = () => !!process.env.GEMINI_API_KEY;

async function gemini(partes: unknown[], json: boolean) {
  const modelo = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: partes }], generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: "application/json" } : {}) } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`IA respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "").trim() as string;
}

export async function identificarPorFoto(imagens: { base64: string; mimetype: string }[], categorias: string[], eanLido?: string): Promise<Identificacao> {
  if (!iaDisponivel()) throw new Error("IA não configurada (falta GEMINI_API_KEY no servidor). Digite o nome do produto para buscar.");
  const prompt = `Você é cadastrador de uma loja que vende produtos de logística reversa (caixa aberta, devolução).
Identifique o produto das fotos. Leia marca, modelo, voltagem, capacidade, cor e código de barras se aparecerem na peça ou na caixa.${eanLido ? `\nO código de barras já foi lido: ${eanLido}.` : ""}
Responda SÓ JSON:
{"titulo": "nome comercial curto, como no Mercado Livre (ex.: Air Fryer Philips Walita 4,1L Preta RI9201)",
 "marca": "", "modelo": "", "ean": "só dígitos, se legível",
 "categoria": "uma destas: ${categorias.join(", ")}",
 "descricao": "2 a 3 frases objetivas sobre o que se vê: o que é, características visíveis. Não invente acessórios.",
 "consulta": "termo de busca para achar o MESMO produto novo no Mercado Livre: marca + modelo + característica principal, sem 'novo' ou 'promoção'"}`;
  const txt = await gemini([{ text: prompt }, ...imagens.slice(0, 4).map((i) => ({ inline_data: { mime_type: i.mimetype, data: i.base64 } }))], true);
  const d = JSON.parse(txt.replace(/^```json|```$/g, "").trim()) as Partial<Identificacao>;
  if (!d.titulo) throw new Error("A IA não reconheceu o produto. Tente fotos mais próximas da etiqueta ou da caixa.");
  return { ...d, titulo: d.titulo, ean: eanLido || d.ean?.replace(/\D/g, "") || undefined, consulta: d.consulta || d.titulo };
}

/** Descrição completa para a loja, a partir da ficha técnica + destaques do catálogo + o que a IA viu. */
export async function escreverDescricao(p: { titulo: string; visto?: string; catalogo?: Catalogo }): Promise<string> {
  const ficha = p.catalogo?.ficha ?? [];
  const destaques = p.catalogo?.destaques ?? [];
  if (!iaDisponivel()) {
    const linhas = [p.visto || p.titulo, ...(destaques.length ? ["", "Destaques:", ...destaques.map((d) => `• ${d}`)] : [])];
    return linhas.join("\n").trim();
  }
  const prompt = `Escreva a descrição de venda de "${p.titulo}" para o site de uma loja de produtos de logística reversa (o produto pode estar com caixa aberta; a condição é informada à parte, não comente sobre ela).
Use SOMENTE as informações abaixo — não invente características, acessórios nem garantia.
Ficha técnica:
${ficha.map((f) => `- ${f.nome}: ${f.valor}`).join("\n") || "(sem ficha)"}
Destaques do fabricante:
${destaques.map((d) => `- ${d}`).join("\n") || "(sem destaques)"}
Observado nas fotos: ${p.visto || "-"}

Formato (texto puro, sem markdown, sem emojis):
1 parágrafo curto apresentando o produto e para que serve.
Linha em branco, depois "Principais características:" e de 4 a 8 linhas começando com "• ".
Se a ficha tiver voltagem/potência/dimensões, cite-as. Português do Brasil, tom direto, sem exageros.`;
  return (await gemini([{ text: prompt }], false)).replace(/\*\*/g, "");
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

type AtributoML = { id: string; name: string; value_name?: string | null };
type ProdutoML = { id: string; name: string; attributes?: AtributoML[]; main_features?: { text: string }[]; short_description?: { content?: string }; pictures?: { url: string }[] };
// atributos que não interessam ao cliente
const IGNORAR = new Set(["ITEM_CONDITION", "SELLER_SKU", "GTIN", "EAN", "UPC", "MPN", "PRODUCT_DATA_SOURCE", "IS_KIT", "IS_HIGHLIGHT_BRAND", "IS_TOM_BRAND", "LINE", "ALPHANUMERIC_MODEL", "SYI_PYMES_ID", "EXCLUSIVE_CHANNEL", "GIFTABLE", "PACKAGE_DATA_SOURCE"]);

function catalogoDe(p: ProdutoML): Catalogo {
  const ficha = (p.attributes ?? [])
    .filter((a) => a.value_name && !IGNORAR.has(a.id) && !/PACKAGE_|SHIPMENT_/.test(a.id))
    .slice(0, 30)
    .map((a) => ({ nome: a.name, valor: String(a.value_name) }));
  const destaques = (p.main_features ?? []).map((f) => f.text).filter(Boolean).slice(0, 8);
  if (!destaques.length && p.short_description?.content) destaques.push(...p.short_description.content.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 6));
  return { nome: p.name, ficha, destaques };
}

async function ofertasDoProduto(id: string, nome: string, token: string, foto?: string): Promise<Anuncio[]> {
  const it = await getML<{ results?: { price: number; condition?: string; item_id: string }[] }>(`/products/${id}/items?limit=30`, token);
  return (it.dados.results ?? [])
    .filter((o) => o.price > 0 && (!o.condition || o.condition === "new"))
    .map((o) => ({ titulo: nome, precoCents: Math.round(o.price * 100), link: `https://produto.mercadolivre.com.br/${o.item_id.replace(/^MLB/, "MLB-")}`, foto }));
}

type ItemBusca = { id: string; title: string; price: number; permalink: string; thumbnail?: string; condition?: string; catalog_product_id?: string | null };

async function buscarML(consulta: string, ean: string | undefined): Promise<{ anuncios: Anuncio[]; catalogo?: Catalogo; porCodigoBarras: boolean }> {
  const token = await tokenML();
  if (!token) throw new Error("Mercado Livre não conectado: abra Configurações → Pesquisa de preço e conecte.");

  // 1) pelo código de barras: produto de catálogo exato
  if (ean) {
    const p = await getML<{ results?: { id: string }[] }>(`/products/search?status=active&site_id=MLB&product_identifier=${ean}`, token);
    const id = p.dados.results?.[0]?.id;
    if (id) {
      const det = await getML<ProdutoML>(`/products/${id}`, token);
      if (det.ok) {
        const anuncios = await ofertasDoProduto(id, det.dados.name, token, det.dados.pictures?.[0]?.url);
        if (anuncios.length) return { anuncios, catalogo: catalogoDe(det.dados), porCodigoBarras: true };
      }
    }
  }
  // 2) pelo nome: busca de anúncios
  const q = encodeURIComponent(consulta);
  const s = await getML<{ results?: ItemBusca[] }>(`/sites/MLB/search?q=${q}&condition=new&limit=50`, token);
  if (s.ok && s.dados.results?.length) {
    const res = s.dados.results.filter((i) => i.price > 0 && (!i.condition || i.condition === "new"));
    // ficha: o produto de catálogo mais frequente nos resultados; senão o 1º anúncio
    const freq = new Map<string, number>();
    for (const i of res) if (i.catalog_product_id) freq.set(i.catalog_product_id, (freq.get(i.catalog_product_id) || 0) + 1);
    const topo = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    let catalogo: Catalogo | undefined;
    if (topo) {
      const det = await getML<ProdutoML>(`/products/${topo}`, token);
      if (det.ok) catalogo = catalogoDe(det.dados);
    } else if (res[0]) {
      const det = await getML<ProdutoML>(`/items/${res[0].id}`, token);
      if (det.ok) catalogo = { ...catalogoDe({ ...det.dados, name: res[0].title }), destaques: [] };
    }
    return {
      anuncios: res.map((i) => ({ titulo: i.title, precoCents: Math.round(i.price * 100), link: i.permalink, foto: i.thumbnail?.replace("http:", "https:") })),
      catalogo,
      porCodigoBarras: false,
    };
  }
  // 3) busca de anúncios fechada para a aplicação: catálogo pelo nome → ofertas
  const p = await getML<{ results?: ProdutoML[] }>(`/products/search?status=active&site_id=MLB&q=${q}&limit=5`, token);
  if (!p.ok) throw new Error(`Mercado Livre recusou a busca (${s.status}/${p.status}). Confira as permissões da aplicação.`);
  const anuncios: Anuncio[] = [];
  let catalogo: Catalogo | undefined;
  for (const prod of p.dados.results ?? []) {
    anuncios.push(...(await ofertasDoProduto(prod.id, prod.name, token, prod.pictures?.[0]?.url)));
    if (!catalogo) {
      const det = await getML<ProdutoML>(`/products/${prod.id}`, token);
      if (det.ok) catalogo = catalogoDe(det.dados);
    }
  }
  return { anuncios, catalogo, porCodigoBarras: false };
}

/** Simulação para testar as telas sem credenciais (preços em torno de um valor derivado do nome). */
function simulado(consulta: string): { anuncios: Anuncio[]; catalogo: Catalogo } {
  let h = 0;
  for (const c of consulta) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const base = 8000 + (h % 60000); // R$ 80 a R$ 680
  const anuncios = Array.from({ length: 12 }, (_, i) => {
    const fator = [0.82, 0.9, 0.94, 0.97, 1, 1, 1.03, 1.06, 1.1, 1.18, 0.3, 2.6][i]; // os 2 últimos são outliers
    return { titulo: `${consulta} (anúncio simulado ${i + 1})`, precoCents: Math.round(base * fator), link: `https://lista.mercadolivre.com.br/${encodeURIComponent(consulta)}` };
  });
  return {
    anuncios,
    catalogo: {
      nome: consulta,
      ficha: [
        { nome: "Marca", valor: "(simulação)" },
        { nome: "Modelo", valor: "(simulação)" },
        { nome: "Voltagem", valor: "127V/220V" },
      ],
      destaques: ["Exemplo de destaque vindo do catálogo do Mercado Livre", "Aparece aqui quando o Mercado Livre estiver conectado"],
    },
  };
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

export async function pesquisarPreco(consulta: string, opts: { marca?: string; descontoPct: number; ean?: string }): Promise<ResultadoPreco> {
  const sim = !mlConfigurado();
  const achado = sim ? { ...simulado(consulta), porCodigoBarras: false } : await buscarML(consulta, opts.ean);
  let anuncios = achado.anuncios;
  if (!anuncios.length) throw new Error(`Nada encontrado no Mercado Livre para “${consulta}”. Ajuste o nome e busque de novo.`);
  // se sabemos a marca, fica só com anúncios que citam a marca (quando sobram pelo menos 3)
  if (opts.marca && !achado.porCodigoBarras) {
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
    porCodigoBarras: achado.porCodigoBarras,
    simulado: sim,
    anuncios: bons,
    descartados: anuncios.length - bons.length,
    minCents: precos[0],
    medianaCents: med,
    maxCents: precos[precos.length - 1],
    sugeridoCents: arredondar90(Math.round(med * (1 - opts.descontoPct / 100))),
    descontoPct: opts.descontoPct,
    catalogo: achado.catalogo,
  };
}
