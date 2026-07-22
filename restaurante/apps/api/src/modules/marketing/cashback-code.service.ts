import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { MessageKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { MessagingService } from './messaging.service';
import { limparTelefone } from './loyalty.service';

/** Quanto tempo o código de 6 dígitos vale. */
const MINUTOS_DO_CODIGO = 10;
/** Depois de confirmado, quanto tempo o cliente tem para fechar o pedido. */
const MINUTOS_DO_TOKEN = 30;
/** Erros de digitação tolerados antes de o código morrer. */
const MAX_TENTATIVAS = 5;
/** Quantos códigos o mesmo telefone pode pedir por hora. */
const MAX_POR_HORA = 5;

/** Guardamos só o resumo. Um código vazado do banco não serve para nada. */
function resumo(codigo: string) {
  return createHash('sha256').update(codigo).digest('hex');
}

/** "48999990001" -> "•••••0001" — confirma o número sem expor o telefone. */
function mascarar(phone: string) {
  return phone.length <= 4 ? phone : '•'.repeat(phone.length - 4) + phone.slice(-4);
}

/**
 * Confirmação por código para GASTAR cashback.
 *
 * O problema que isto resolve: até aqui, o telefone era a única identificação
 * do cliente. Quem soubesse o telefone de outra pessoa gastava o cashback dela
 * — e telefone não é segredo. Agora, para USAR o saldo, o cliente confirma um
 * código de 6 dígitos enviado no canal dele.
 *
 * Repare que o código sai pela MESMA porta de mensagens das campanhas. Hoje o
 * adaptador é fake e o código aparece no log; quando o WhatsApp de verdade for
 * ligado (Etapa 7), o mesmo código passa a chegar no celular do cliente sem
 * uma linha de código mudar aqui.
 */
@Injectable()
export class CashbackCodeService {
  private readonly logger = new Logger(CashbackCodeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly context: TenantContextService,
    private readonly mensagens: MessagingService,
  ) {}

  private async acharMarca(brandSlug: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: brandSlug },
      select: { id: true, tenantId: true, name: true },
    });
    if (!brand) throw new NotFoundException('Restaurante não encontrado.');
    return brand;
  }

  /**
   * Passo 1: o cliente pede o código.
   *
   * A resposta é DELIBERADAMENTE a mesma para telefone que existe e telefone
   * que não existe. Se disséssemos "esse número não tem cadastro", a tela
   * viraria uma máquina de descobrir quem é cliente da casa.
   */
  async pedir(brandSlug: string, telefone: string) {
    const brand = await this.acharMarca(brandSlug);
    const phone = limparTelefone(telefone);

    if (phone.length < 10) {
      throw new BadRequestException('Informe um telefone com DDD.');
    }

    return this.context.runAsTenant(brand.tenantId, async () => {
      // Trava de abuso: sem isto, dá para pedir código sem parar e usar o
      // sistema como metralhadora de mensagens no telefone de alguém.
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
      const recentes = await this.tenantPrisma.db.cashbackCode.count({
        where: { brandId: brand.id, phone, createdAt: { gte: umaHoraAtras } },
      });
      if (recentes >= MAX_POR_HORA) {
        throw new BadRequestException(
          'Muitas tentativas. Espere alguns minutos antes de pedir outro código.',
        );
      }

      const cliente = await this.tenantPrisma.db.tenantCustomer.findFirst({
        where: { brandId: brand.id, phone },
        select: { id: true, cashbackBalanceCents: true },
      });

      const resposta = {
        enviado: true,
        para: mascarar(phone),
        validoPorMinutos: MINUTOS_DO_CODIGO,
        /**
         * Só em desenvolvimento. Como o WhatsApp ainda é fake, sem isto não
         * haveria como testar o fluxo — a mensagem morre no log do servidor.
         * Em produção este campo simplesmente não existe.
         */
        codigoDeTeste: undefined as string | undefined,
      };

      // Telefone sem cadastro ou sem saldo: respondemos igualzinho, mas não
      // gastamos mensagem nem criamos código.
      if (!cliente || cliente.cashbackBalanceCents <= 0) return resposta;

      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');

      await this.tenantPrisma.db.cashbackCode.create({
        data: {
          tenantId: brand.tenantId,
          brandId: brand.id,
          phone,
          codeHash: resumo(codigo),
          expiresAt: new Date(Date.now() + MINUTOS_DO_CODIGO * 60 * 1000),
        },
      });

      await this.mensagens.enfileirar({
        tenantId: brand.tenantId,
        brandId: brand.id,
        customerId: cliente.id,
        kind: MessageKind.ORDER_UPDATE,
        to: phone,
        body:
          `Seu código para usar o cashback na ${brand.name} é ${codigo}. ` +
          `Vale por ${MINUTOS_DO_CODIGO} minutos. Se não foi você que pediu, ignore.`,
      });

      if (process.env.NODE_ENV !== 'production') {
        resposta.codigoDeTeste = codigo;
        this.logger.warn(`[DEV] Código de cashback de ${mascarar(phone)}: ${codigo}`);
      }

      return resposta;
    });
  }

  /**
   * Passo 2: o cliente digita o código.
   *
   * Dando certo, devolvemos uma senha temporária (o token) que o fechamento do
   * pedido vai exigir. O token vale para UM pedido e para AQUELE telefone.
   */
  async confirmar(brandSlug: string, telefone: string, codigo: string) {
    const brand = await this.acharMarca(brandSlug);
    const phone = limparTelefone(telefone);
    const digitado = (codigo ?? '').replace(/\D/g, '');

    return this.context.runAsTenant(brand.tenantId, async () => {
      const registro = await this.tenantPrisma.db.cashbackCode.findFirst({
        where: {
          brandId: brand.id,
          phone,
          confirmedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: MAX_TENTATIVAS },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Mensagem única de propósito: não dizemos se o código expirou, se nunca
      // existiu ou se está errado — cada distinção dessas ajuda quem chuta.
      const recusar = () => {
        throw new BadRequestException('Código inválido ou expirado. Peça um novo.');
      };

      if (!registro) return recusar();

      if (registro.codeHash !== resumo(digitado)) {
        await this.tenantPrisma.db.cashbackCode.update({
          where: { id: registro.id },
          data: { attempts: { increment: 1 } },
        });
        return recusar();
      }

      const token = randomUUID();
      await this.tenantPrisma.db.cashbackCode.update({
        where: { id: registro.id },
        data: {
          confirmedAt: new Date(),
          redeemToken: token,
          // A partir daqui vale o prazo do token, não o do código.
          expiresAt: new Date(Date.now() + MINUTOS_DO_TOKEN * 60 * 1000),
        },
      });

      return { confirmado: true, token, validoPorMinutos: MINUTOS_DO_TOKEN };
    });
  }

  /**
   * Passo 3: o fechamento do pedido pergunta "posso deixar gastar?".
   *
   * Confere que o token existe, é daquela marca, daquele telefone, não venceu
   * e não foi usado. Dá certo, marca como usado na hora — um token, um pedido.
   */
  async consumirToken(brandId: string, telefone: string, token?: string) {
    const phone = limparTelefone(telefone);

    if (!token) {
      throw new BadRequestException(
        'Para usar o cashback, confirme o código que enviamos no seu telefone.',
      );
    }

    const registro = await this.tenantPrisma.db.cashbackCode.findFirst({
      where: {
        redeemToken: token,
        brandId,
        phone,
        tokenUsedAt: null,
        confirmedAt: { not: null },
        expiresAt: { gt: new Date() },
      },
    });

    if (!registro) {
      throw new BadRequestException(
        'A confirmação do cashback venceu ou já foi usada. Peça um novo código.',
      );
    }

    await this.tenantPrisma.db.cashbackCode.update({
      where: { id: registro.id },
      data: { tokenUsedAt: new Date() },
    });

    return true;
  }
}
