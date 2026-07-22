import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/** As filas do sistema. */
export const FILAS = {
  /** enviar UMA mensagem para UM cliente */
  MENSAGENS: 'mensagens',
  /** abrir uma campanha em N mensagens */
  CAMPANHAS: 'campanhas',
  /** faxina diária: vencer cashback, expirar carrinho parado */
  MANUTENCAO: 'manutencao',
} as const;

type Processador = (job: Job) => Promise<unknown>;

/**
 * A FILA DE TAREFAS.
 *
 * Para que serve, em português: algumas coisas não podem acontecer na hora em
 * que o cliente aperta o botão — mandar 5.000 mensagens de campanha, lembrar de
 * um carrinho daqui a 30 minutos, perguntar a nota do pedido uma hora depois.
 *
 * A fila resolve isso: a tarefa é anotada no Redis e alguém pega depois. Se der
 * erro, tenta de novo. Se o servidor reiniciar, a tarefa continua lá.
 *
 * ⚠️ Hoje os "trabalhadores" rodam dentro da própria API. Em produção com muito
 * volume, eles viram um processo separado — é só não registrar os workers aqui.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);

  private readonly filas = new Map<string, Queue>();
  private readonly trabalhadores: Worker[] = [];
  /** guardado até os módulos registrarem seus processadores */
  private readonly processadores = new Map<string, Processador>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** A conexão que a BullMQ usa. */
  private get conexao() {
    return { connection: this.redis.options as any };
  }

  onModuleInit() {
    for (const nome of Object.values(FILAS)) {
      this.filas.set(
        nome,
        new Queue(nome, {
          ...this.conexao,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 500,
            removeOnFail: 1000,
          },
        }),
      );
    }
    this.logger.log(`Filas prontas: ${Object.values(FILAS).join(', ')}`);
  }

  async onApplicationShutdown() {
    await Promise.all(this.trabalhadores.map((w) => w.close()));
    await Promise.all([...this.filas.values()].map((q) => q.close()));
  }

  /** Põe uma tarefa na fila. `atrasoMs` agenda para o futuro. */
  async agendar(fila: string, nome: string, dados: unknown, atrasoMs = 0) {
    const q = this.filas.get(fila);
    if (!q) throw new Error(`Fila "${fila}" não existe.`);
    return q.add(nome, dados, atrasoMs > 0 ? { delay: atrasoMs } : undefined);
  }

  /** Tarefa que se repete sozinha (ex.: todo dia às 3h da manhã). */
  async agendarRepetida(fila: string, nome: string, dados: unknown, cron: string) {
    const q = this.filas.get(fila);
    if (!q) throw new Error(`Fila "${fila}" não existe.`);
    return q.add(nome, dados, {
      repeat: { pattern: cron },
      jobId: `repetida:${nome}`,
    });
  }

  /**
   * Cada módulo diz aqui como processar a sua fila.
   * Chamado na inicialização, uma vez por fila.
   */
  registrarTrabalhador(fila: string, processador: Processador, concorrencia = 5) {
    if (this.processadores.has(fila)) {
      this.logger.warn(`A fila "${fila}" já tem um trabalhador — ignorando o segundo.`);
      return;
    }
    this.processadores.set(fila, processador);

    const worker = new Worker(
      fila,
      async (job) => {
        this.logger.debug(`[${fila}] processando ${job.name} (${job.id})`);
        return processador(job);
      },
      { ...this.conexao, concurrency: concorrencia },
    );

    worker.on('failed', (job, erro) => {
      this.logger.error(`[${fila}] tarefa ${job?.name} falhou: ${erro?.message}`);
    });

    this.trabalhadores.push(worker);
    this.logger.log(`Trabalhador da fila "${fila}" ligado (${concorrencia} por vez).`);
  }

  /** Números da fila, para a tela de marketing mostrar. */
  async situacao(fila: string) {
    const q = this.filas.get(fila);
    if (!q) return null;
    const [esperando, ativas, concluidas, falhas, atrasadas] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
      q.getDelayedCount(),
    ]);
    return { fila, esperando, ativas, concluidas, falhas, atrasadas };
  }
}
