import { env } from '../../env.js';

// Classificacao de documentos do e-Continuo via IA.
// Quando as assinaturas (palavras-chave) NAO casam, a IA le o texto do documento
// e a lista de obrigacoes do escritorio e responde qual obrigacao corresponde.
// O resultado e' apenas uma SUGESTAO na tela de Revisao - o humano confirma.
//
// Provedores suportados (env IA_PROVIDER):
//   - 'gemini'    -> Google Gemini (tem nivel GRATIS). Default.
//   - 'anthropic' -> Claude (pago por uso).

export interface SugestaoIa {
  obrigacao: string | null;   // nome exato (da lista) ou null se nao reconhecer
  confianca: number | null;   // 0..1 (null = a IA nao informou de forma utilizavel)
  palavras: string[];         // 1-3 termos do documento que justificam (p/ virar assinatura)
}

// A IA as vezes responde a confianca como texto ("alta") em vez de numero.
function normalizarConfianca(v: unknown): number | null {
  if (typeof v === 'number') return Math.max(0, Math.min(1, v));
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s.includes('alta') || s.includes('high')) return 0.9;
    if (s.includes('med')) return 0.6;
    if (s.includes('baix') || s.includes('low')) return 0.3;
    const n = parseFloat(s.replace(',', '.'));
    if (!Number.isNaN(n)) return n > 1 ? Math.min(1, n / 100) : Math.max(0, n);
  }
  return null;
}

export function iaDisponivel(): boolean {
  return !!env.ia.apiKey;
}

function montarPrompt(texto: string, obrigacoes: string[]): string {
  const doc = texto.slice(0, 4000); // primeiras ~4k chars bastam p/ identificar a guia
  const lista = obrigacoes.map((o) => `- ${o}`).join('\n');
  return (
    'Voce classifica documentos fiscais/contabeis brasileiros (guias, DARF, DAS, INSS, ' +
    'FGTS, DCTFWeb, folha de pagamento, etc.) de um escritorio de contabilidade.\n\n' +
    'Dada a lista de OBRIGACOES cadastradas e o TEXTO de um documento, responda qual ' +
    'obrigacao corresponde. Use SOMENTE um nome EXATO da lista. Se nenhuma corresponder ' +
    'com seguranca, devolva obrigacao=null.\n\n' +
    `OBRIGACOES DISPONIVEIS:\n${lista}\n\n` +
    `TEXTO DO DOCUMENTO:\n"""\n${doc}\n"""\n\n` +
    'Responda APENAS um JSON valido, sem texto antes ou depois, no formato:\n' +
    '{"obrigacao": "<nome exato da lista ou null>", "confianca": <numero decimal entre 0 e 1, ex: 0.9>, ' +
    '"palavras": ["termo curto 1", "termo 2"]}\n' +
    'Em "palavras", escolha 1 a 3 termos/expressoes que aparecem no texto e identificam ' +
    'esse tipo de documento (ex.: um titulo, um codigo de receita), para servir de regra futura.'
  );
}

// POST com retry para erros transitorios (429 rate limit, 5xx sobrecarga).
// O free tier do Gemini retorna 429/503 com frequencia; tentar de novo resolve a maioria.
// Backoff generoso: o free tier do Gemini limita req/minuto e pede ~20s de espera
// no 429. Esperas progressivas cobrem esse intervalo (o processamento e' assincrono).
const BACKOFF_MS = [4000, 9000, 16000];
async function postComRetry(url: string, options: RequestInit): Promise<Response | null> {
  for (let i = 0; i <= BACKOFF_MS.length; i++) {
    try {
      const resp = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
      if (resp.ok) return resp;
      const transitorio = resp.status === 429 || resp.status === 500 || resp.status === 502 || resp.status === 503;
      if (!transitorio || i === BACKOFF_MS.length) return null;
    } catch {
      if (i === BACKOFF_MS.length) return null;
    }
    await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
  }
  return null;
}

// ---- Google Gemini (free tier) ----
async function chamarGemini(prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.ia.model}:generateContent?key=${env.ia.apiKey}`;
  const resp = await postComRetry(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 300, responseMimeType: 'application/json' },
    }),
  });
  if (!resp) return null;
  const data = (await resp.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

// ---- Anthropic Claude (pago) ----
async function chamarAnthropic(prompt: string): Promise<string | null> {
  const resp = await postComRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ia.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.ia.model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp) return null;
  const data = (await resp.json()) as { content?: { type: string; text?: string }[] };
  return data.content?.find((c) => c.type === 'text')?.text ?? null;
}

export async function classificarObrigacao(
  texto: string,
  obrigacoes: string[],
): Promise<SugestaoIa | null> {
  if (!env.ia.apiKey || obrigacoes.length === 0) return null;

  const prompt = montarPrompt(texto, obrigacoes);

  try {
    const bruto = env.ia.provider === 'anthropic'
      ? await chamarAnthropic(prompt)
      : await chamarGemini(prompt);
    if (!bruto) return null;

    const json = bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as { obrigacao: unknown; confianca: unknown; palavras: unknown };

    const obrigacao = typeof parsed.obrigacao === 'string' ? parsed.obrigacao : null;
    // so aceita se for um nome EXATO da lista (evita alucinacao)
    const valida = obrigacao && obrigacoes.includes(obrigacao) ? obrigacao : null;
    const confianca = normalizarConfianca(parsed.confianca);
    const palavras = Array.isArray(parsed.palavras)
      ? parsed.palavras.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).slice(0, 3)
      : [];

    return { obrigacao: valida, confianca: valida ? confianca : null, palavras };
  } catch {
    return null; // falha de rede / parsing -> degrada para as regras
  }
}
