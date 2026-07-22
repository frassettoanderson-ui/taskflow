import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InboundMessage, MessagingProvider, OutboundMessage } from './messaging.port';

/**
 * ADAPTADOR FAKE DE MENSAGENS.
 *
 * Ele finge ser o WhatsApp: aceita a mensagem, devolve um id e escreve tudo no
 * log do servidor. Nada sai da sua máquina, nenhuma conta em serviço externo.
 *
 * Para você CONFERIR o que "foi enviado" existem dois lugares:
 *   1) o log do backend (docker compose logs -f api)
 *   2) a tabela outbound_messages, que aparece na tela de Marketing
 *
 * Trocar por WhatsApp de verdade, na Etapa 7, mexe só neste arquivo.
 */
@Injectable()
export class FakeMessagingProvider implements MessagingProvider {
  private readonly logger = new Logger('WhatsApp(fake)');

  async send(message: OutboundMessage): Promise<{ id: string }> {
    const id = `msg_${randomUUID().slice(0, 12)}`;

    // Simula a demora de uma API real, para a fila se comportar de verdade.
    await new Promise((r) => setTimeout(r, 40));

    // Um número de telefone claramente inválido "falha" de propósito: assim dá
    // para ver a fila tentando de novo e o relatório contando o erro.
    if (!message.to || message.to.replace(/\D/g, '').length < 10) {
      throw new Error(`Número inválido: "${message.to}"`);
    }

    this.logger.log(
      `→ ${message.channel} ${message.to}: ${message.text?.slice(0, 120)}${
        (message.text?.length ?? 0) > 120 ? '…' : ''
      }`,
    );

    return { id };
  }

  /**
   * Receber mensagem do cliente só faz sentido com WhatsApp de verdade
   * (Etapa 7). Por enquanto devolvemos "nada chegou".
   */
  async handleWebhook(_payload: unknown): Promise<InboundMessage | null> {
    return null;
  }
}
