import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { Observable, Subject, filter, map, merge, interval } from 'rxjs';
import { REDIS_CLIENT, REDIS_SUBSCRIBER } from '../../redis/redis.module';

/** Canal do Redis por onde passam os avisos de pedido. */
const CANAL = 'pedidos';

export interface AvisoDePedido {
  tenantId: string;
  brandId?: string;
  orderId?: string;
  orderCode?: string;
  /** salão: para a tela da mesa e o mapa de mesas reagirem */
  tableId?: string;
  sessionId?: string;
  /** ex.: "order.created", "order.status_changed", "table.call", "session.paid" */
  type: string;
  data?: Record<string, unknown>;
  at: string;
}

/**
 * O "alto-falante" do sistema.
 *
 * Quem muda um pedido não sabe (nem precisa saber) quem está ouvindo. Ele só
 * grita aqui. Quem estiver com a tela da cozinha ou o acompanhamento aberto
 * escuta e atualiza sozinho.
 *
 * Se ninguém estiver ouvindo, nada acontece — e o pedido segue normalmente.
 * É esse desacoplamento que o CLAUDE.md pede.
 */
@Injectable()
export class RealtimeService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly avisos = new Subject<AvisoDePedido>();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  async onModuleInit() {
    await this.subscriber.subscribe(CANAL);
    this.subscriber.on('message', (canal, mensagem) => {
      if (canal !== CANAL) return;
      try {
        this.avisos.next(JSON.parse(mensagem) as AvisoDePedido);
      } catch {
        this.logger.warn('Aviso do Redis veio em formato inválido — ignorado.');
      }
    });
  }

  /** Grita o aviso. Nunca derruba quem chamou: se o Redis falhar, só registra. */
  async publicar(aviso: AvisoDePedido) {
    try {
      await this.redis.publish(CANAL, JSON.stringify(aviso));
    } catch (e) {
      this.logger.error(`Não consegui publicar o aviso ${aviso.type}: ${e}`);
    }
  }

  /** Fluxo de avisos de UM restaurante — usado pela tela da cozinha. */
  streamDoTenant(tenantId: string): Observable<MessageEvent> {
    return this.comBatimento(this.avisos.pipe(filter((a) => a.tenantId === tenantId)));
  }

  /** Fluxo de avisos de UM pedido — usado pela tela do cliente. */
  streamDoPedido(orderId: string): Observable<MessageEvent> {
    return this.comBatimento(this.avisos.pipe(filter((a) => a.orderId === orderId)));
  }

  /** Fluxo de avisos de UMA mesa — usado pela tela do cliente sentado. */
  streamDaMesa(tableId: string): Observable<MessageEvent> {
    return this.comBatimento(this.avisos.pipe(filter((a) => a.tableId === tableId)));
  }

  /**
   * Junta os avisos com um "batimento cardíaco" a cada 25 segundos.
   * Serve para a conexão não ser cortada por inatividade.
   */
  private comBatimento(fonte: Observable<AvisoDePedido>): Observable<MessageEvent> {
    const eventos = fonte.pipe(map((a) => ({ data: a }) as MessageEvent));
    const batimento = interval(25000).pipe(
      map(() => ({ data: { type: 'ping' } }) as MessageEvent),
    );
    return merge(eventos, batimento);
  }
}
