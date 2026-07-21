/**
 * PORTA: mensagens com o cliente — WhatsApp, Instagram, Facebook e notificações.
 * É por aqui que, mais pra frente, entra a IA conversacional.
 */

export const MESSAGING_PROVIDER = 'MESSAGING_PROVIDER';

export type MessagingChannel = 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'PUSH';

export interface OutboundMessage {
  tenantId: string;
  channel: MessagingChannel;
  /** telefone ou id do destinatário */
  to: string;
  text?: string;
  mediaUrl?: string;
}

export interface InboundMessage {
  tenantId: string;
  channel: MessagingChannel;
  from: string;
  text?: string;
  /** áudio e imagem que a IA vai precisar entender */
  mediaUrl?: string;
  mediaType?: 'audio' | 'image' | 'document';
}

export interface MessagingProvider {
  send(message: OutboundMessage): Promise<{ id: string }>;
  /** Recebe o que chega do canal e normaliza para o formato acima. */
  handleWebhook(payload: unknown): Promise<InboundMessage | null>;
}
