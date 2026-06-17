import { env } from '../../env.js';

// Abstracao de provedor de WhatsApp.
export interface WhatsAppProvider {
  // Gera a forma de envio. wa.me retorna um link para abrir manualmente;
  // a Cloud API enviaria de fato e retornaria o id da mensagem.
  enviar(input: { numero: string; mensagem: string }): Promise<{ tipo: 'link' | 'api'; link?: string; id?: string }>;
}

function soDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

// Implementacao 1 (default): link wa.me (compartilhamento manual).
export const waMeProvider: WhatsAppProvider = {
  async enviar({ numero, mensagem }) {
    const n = soDigitos(numero);
    const numeroComDDI = n.startsWith('55') ? n : `55${n}`;
    const link = `https://wa.me/${numeroComDDI}?text=${encodeURIComponent(mensagem)}`;
    return { tipo: 'link', link };
  },
};

// Implementacao 2 (STUB): Meta WhatsApp Cloud API.
// Para ativar: preencher WHATSAPP_CLOUD_TOKEN e WHATSAPP_PHONE_NUMBER_ID no .env
// e implementar a chamada HTTP abaixo (POST /{phoneNumberId}/messages).
export const metaCloudProvider: WhatsAppProvider = {
  async enviar({ numero }) {
    if (!env.whatsapp?.cloudToken || !env.whatsapp?.phoneNumberId) {
      throw new Error('Meta WhatsApp Cloud API nao configurada (defina WHATSAPP_CLOUD_TOKEN e WHATSAPP_PHONE_NUMBER_ID).');
    }
    // STUB documentado - implementar quando houver credenciais:
    // const resp = await fetch(`https://graph.facebook.com/v20.0/${env.whatsapp.phoneNumberId}/messages`, {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${env.whatsapp.cloudToken}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ messaging_product: 'whatsapp', to: soDigitos(numero), type: 'text', text: { body: mensagem } }),
    // });
    // const json = await resp.json();
    // return { tipo: 'api', id: json.messages?.[0]?.id };
    void numero;
    throw new Error('Envio via Cloud API ainda nao implementado (stub).');
  },
};

export function getWhatsAppProvider(): WhatsAppProvider {
  return env.whatsapp?.provider === 'meta_cloud' ? metaCloudProvider : waMeProvider;
}
