import { env } from '../../env.js';

// Classificacao de documentos do e-Continuo via Claude.
// Quando as assinaturas (palavras-chave) NAO casam, a IA le o texto do documento
// e a lista de obrigacoes do escritorio e responde qual obrigacao corresponde.
// O resultado e' apenas uma SUGESTAO na tela de Revisao - o humano confirma.

export interface SugestaoIa {
  obrigacao: string | null; // nome exato (da lista) ou null se nao reconhecer
  confianca: number;        // 0..1
  palavras: string[];       // 1-3 termos do documento que justificam (p/ virar assinatura)
}

export function iaDisponivel(): boolean {
  return !!env.ia.apiKey;
}

export async function classificarObrigacao(
  texto: string,
  obrigacoes: string[],
): Promise<SugestaoIa | null> {
  if (!env.ia.apiKey || obrigacoes.length === 0) return null;

  const doc = texto.slice(0, 4000); // primeiras ~4k chars bastam p/ identificar a guia
  const lista = obrigacoes.map((o) => `- ${o}`).join('\n');

  const prompt =
    'Voce classifica documentos fiscais/contabeis brasileiros (guias, DARF, DAS, INSS, ' +
    'FGTS, DCTFWeb, folha de pagamento, etc.) de um escritorio de contabilidade.\n\n' +
    'Dada a lista de OBRIGACOES cadastradas e o TEXTO de um documento, responda qual ' +
    'obrigacao corresponde. Use SOMENTE um nome EXATO da lista. Se nenhuma corresponder ' +
    'com seguranca, devolva obrigacao=null.\n\n' +
    `OBRIGACOES DISPONIVEIS:\n${lista}\n\n` +
    `TEXTO DO DOCUMENTO:\n"""\n${doc}\n"""\n\n` +
    'Responda APENAS um JSON valido, sem texto antes ou depois, no formato:\n' +
    '{"obrigacao": "<nome exato da lista ou null>", "confianca": <0 a 1>, ' +
    '"palavras": ["termo curto 1", "termo 2"]}\n' +
    'Em "palavras", escolha 1 a 3 termos/expressoes que aparecem no texto e identificam ' +
    'esse tipo de documento (ex.: um titulo, um codigo de receita), para servir de regra futura.';

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
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
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) return null;

    const data = (await resp.json()) as { content?: { type: string; text?: string }[] };
    const texto0 = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const json = texto0.slice(texto0.indexOf('{'), texto0.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as { obrigacao: unknown; confianca: unknown; palavras: unknown };

    const obrigacao = typeof parsed.obrigacao === 'string' ? parsed.obrigacao : null;
    // so aceita se for um nome EXATO da lista (evita alucinacao)
    const valida = obrigacao && obrigacoes.includes(obrigacao) ? obrigacao : null;
    const confianca = typeof parsed.confianca === 'number' ? Math.max(0, Math.min(1, parsed.confianca)) : 0;
    const palavras = Array.isArray(parsed.palavras)
      ? parsed.palavras.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).slice(0, 3)
      : [];

    return { obrigacao: valida, confianca: valida ? confianca : 0, palavras };
  } catch {
    return null; // falha de rede / parsing -> degrada para as regras
  }
}
