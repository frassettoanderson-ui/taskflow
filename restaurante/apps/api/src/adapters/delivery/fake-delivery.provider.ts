import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DeliveryProvider, Dispatch, DispatchInput } from './delivery.port';

/**
 * ADAPTADOR FAKE DE ENTREGA.
 *
 * Ele finge ser um serviço de despacho (Lalamove, Loggi, ou a frota própria com
 * app): aceita a corrida, devolve um id e um link de rastreio. Nenhum motoboy
 * de verdade é chamado, nenhuma conta em serviço externo.
 *
 * A escolha de QUEM vai entregar, neste momento, é feita no painel pelo
 * restaurante. Quando entrar um serviço real, na Etapa 7, é ele quem escolhe —
 * e a troca mexe só neste arquivo.
 */
@Injectable()
export class FakeDeliveryProvider implements DeliveryProvider {
  private readonly logger = new Logger('Entrega(fake)');

  /** Memória do serviço de mentira. A verdade oficial fica no banco. */
  private readonly corridas = new Map<string, Dispatch>();

  async dispatch(input: DispatchInput): Promise<Dispatch> {
    const id = `dsp_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const corrida: Dispatch = {
      id,
      status: 'SEARCHING',
      trackingUrl: `/entrega/${id.slice(-8).toUpperCase()}`,
    };

    this.corridas.set(id, corrida);

    this.logger.log(
      `→ corrida ${id} do pedido ${input.orderId}: ` +
        `${input.pickup.address} → ${input.dropoff.address} ` +
        `(motoboy recebe ${input.courierPayoutCents} centavos)`,
    );

    return corrida;
  }

  async get(dispatchId: string): Promise<Dispatch> {
    const c = this.corridas.get(dispatchId);
    if (!c) throw new NotFoundException('Corrida não encontrada no serviço fake.');
    return c;
  }

  async cancel(dispatchId: string, reason: string): Promise<Dispatch> {
    const c = await this.get(dispatchId);
    c.status = 'CANCELED';
    this.logger.log(`→ corrida ${dispatchId} cancelada: ${reason}`);
    return c;
  }
}
