// IA com a chave do próprio usuário (Groq, Gemini ou OpenAI), chamada direto do service worker.
// A IA só escreve rascunhos: o texto vai para o campo de mensagem e a pessoa revisa e envia.
import { MODELO_PADRAO_IA, type ConfigIA, type ProvedorIA } from './dados';

export type AcaoIA = 'corrigir' | 'melhorar' | 'criar' | 'responder' | 'atender';

/** A IA do atendimento automático responde só isto quando não deve mandar nada. */
export const SEM_RESPOSTA = '[SEM_RESPOSTA]';
/** ...e começa com isto quando precisa de alguém da equipe. */
export const CHAMAR_ATENDENTE = '[ATENDENTE]';

export interface PedidoIA {
  tipo: 'ia';
  acao: AcaoIA;
  texto: string;
  /** criar: o pedido; responder: a conversa já formatada */
  contexto?: string;
  /** atender: instruções do dono para a IA que atende sozinha */
  instrucoes?: string;
}

const BASE = 'Responda somente com o texto final da mensagem, sem aspas, sem explicações e sem títulos. Mensagens de WhatsApp: frases curtas, naturais, em português do Brasil. Pode usar *negrito* do WhatsApp com moderação. Não use emojis a menos que o texto original já tenha.';

export function montarPrompt(p: PedidoIA, cfg: ConfigIA): { sistema: string; usuario: string } {
  const negocio = cfg.sobreNegocio.trim() ? `\nSobre o negócio de quem escreve: ${cfg.sobreNegocio.trim()}` : '';
  const tom = `\nTom de voz: ${cfg.tom.trim() || 'cordial e direto'}.`;
  switch (p.acao) {
    case 'corrigir':
      return {
        sistema: `Você corrige ortografia, acentuação, pontuação e concordância. Não mude o sentido, o tom nem a ordem das ideias; só corrija. ${BASE}`,
        usuario: p.texto,
      };
    case 'melhorar':
      return {
        sistema:
          `Você reescreve mensagens comerciais para ficarem mais claras, objetivas e convincentes, mantendo a intenção original.${negocio}${tom}\n` +
          'Regras: tire repetição e palavras sobrando; destaque o benefício principal; termine com um próximo passo claro quando fizer sentido. ' +
          'NUNCA invente escassez, prazo, desconto, preço ou garantia que não estejam no texto original (nada de "últimas vagas", "só hoje", "oferta exclusiva" se o original não disser isso). ' +
          `Não acrescente informações que você não sabe. ${BASE}`,
        usuario: p.texto,
      };
    case 'criar':
      return {
        sistema: `Você escreve mensagens de WhatsApp para atendimento e vendas a partir de um pedido.${negocio}${tom}\nNão invente preços, prazos ou condições: se precisar de um dado que não foi informado, use um marcador entre colchetes, como [valor]. ${BASE}`,
        usuario: p.contexto ?? p.texto,
      };
    case 'atender':
      return {
        sistema:
          `Você é o assistente virtual que faz o primeiro atendimento de uma empresa no WhatsApp. Escreva a PRÓXIMA mensagem para o cliente, respondendo ao que ele disse por último.${negocio}${tom}\n` +
          (p.instrucoes?.trim() ? `Instruções do dono da empresa (siga à risca):\n${p.instrucoes.trim()}\n` : '') +
          'Regras:\n' +
          '- Use só as informações acima. NUNCA invente preço, prazo, estoque, endereço, horário, desconto ou política.\n' +
          `- Se não souber responder, se o cliente pedir para falar com uma pessoa, reclamar, quiser fechar negócio/pagar ou negociar valores, responda começando com ${CHAMAR_ATENDENTE} seguido de uma frase curta avisando que vai chamar alguém da equipe.\n` +
          `- Se a última mensagem do cliente não pede resposta (só "ok", "obrigado", figurinha, ou só um cumprimento que já foi respondido na conversa), responda exatamente ${SEM_RESPOSTA}.\n` +
          '- Você não ouve áudios nem vê imagens/vídeos ([áudio], [imagem] na conversa): peça com gentileza para o cliente escrever, ou chame a equipe se for importante.\n' +
          '- Não diga que é uma pessoa. Se perguntarem, diga que é o assistente virtual e que a equipe pode assumir.\n' +
          '- No máximo 3 frases curtas. Não repita a saudação que já foi enviada.\n' +
          BASE,
        usuario: p.contexto ?? p.texto,
      };
    case 'responder':
      return {
        sistema:
          `Você ajuda um atendente a responder um cliente no WhatsApp. Escreva a PRÓXIMA mensagem do atendente, respondendo ao que o cliente disse por último.${negocio}${tom}\n` +
          'Não invente preços, prazos, estoque ou políticas: se a resposta depender disso, escreva com um marcador entre colchetes, como [preço], para o atendente completar. ' +
          `Se o cliente pediu para não receber mais mensagens, escreva apenas uma confirmação educada. ${BASE}`,
        usuario: `${p.contexto ?? ''}${p.texto.trim() ? `\n\nRascunho do atendente (use como base): ${p.texto}` : ''}`,
      };
  }
}

export async function chamarIA(cfg: ConfigIA, sistema: string, usuario: string): Promise<string> {
  const provedor: ProvedorIA = cfg.provedor;
  const chave = cfg.chaves[provedor]?.trim();
  if (!chave) throw new Error('Cadastre a chave da IA em Configurações > IA');
  const modelo = cfg.modelo[provedor]?.trim() || MODELO_PADRAO_IA[provedor];

  if (provedor === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: [{ text: usuario }] }], generationConfig: { temperature: 0.5 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message ?? `Gemini respondeu ${r.status}`);
    return (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  }

  const url = provedor === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      ...(provedor === 'groq' ? { temperature: 0.5 } : {}),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `${provedor} respondeu ${r.status}`);
  return (j?.choices?.[0]?.message?.content ?? '').trim();
}
