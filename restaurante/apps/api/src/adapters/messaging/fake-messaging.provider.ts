import { Injectable, NotImplementedException } from '@nestjs/common';
import { InboundMessage, MessagingProvider, OutboundMessage } from './messaging.port';

/** ADAPTADOR FAKE de mensagens — vazio. Vira real na Etapa 7. */
@Injectable()
export class FakeMessagingProvider implements MessagingProvider {
  async send(_message: OutboundMessage): Promise<{ id: string }> {
    throw new NotImplementedException('Mensageria fake ainda não implementada (Etapa 7).');
  }

  async handleWebhook(_payload: unknown): Promise<InboundMessage | null> {
    throw new NotImplementedException('Mensageria fake ainda não implementada (Etapa 7).');
  }
}
