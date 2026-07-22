import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';

/**
 * Tabelas que pertencem a um tenant. Toda tabela nova do projeto que tiver
 * a coluna "tenantId" PRECISA ser listada aqui.
 *
 * (Na Etapa 1 entram Menu, Category, Item, Order etc.)
 */
export const TENANT_SCOPED_MODELS = new Set([
  // Etapa 0
  'User',
  'Brand',
  // Etapa 1 — catálogo
  'Menu',
  'Category',
  'Item',
  'ModifierGroup',
  'Modifier',
  // Etapa 4 — CRM, fidelidade e marketing
  'TenantCustomer',
  'LoyaltyProgram',
  'CashbackEntry',
  'Coupon',
  'CouponRedemption',
  'Campaign',
  'OutboundMessage',
  'AbandonedCart',
  'NpsResponse',
  // (NetworkCustomer fica de fora: é a carteira da REDE, não de um tenant)
  // Etapa 1 — pedido
  'Order',
  'OrderItem',
  'OrderItemModifier',
  'OrderEvent',
  'Payment',
  // Etapa 2 — multimarca, multicanal e multiunidade
  'Unit',
  'BrandUnit',
  'Station',
  'UnitItemOverride',
  'DeliveryArea',
  'OpeningHour',
  // Etapa 3 — salão
  'Table',
  'TableSession',
  'ServiceCall',
  'Reservation',
  'WaitlistEntry',
  // (ProcessedWebhook fica de fora de propósito: é tabela de sistema)
]);

/** Operações que filtram registros — nelas injetamos o tenantId no "where". */
const WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/**
 * O "filtro garantido em código" — o isolamento entre restaurantes.
 *
 * Como funciona, em português: toda consulta que passa por aqui ganha
 * automaticamente um "…E que seja do tenant X" grudado nela, sendo X o tenant
 * do usuário logado. E se por algum motivo não houver usuário logado, a
 * consulta NÃO roda: estoura um erro na hora.
 *
 * O ponto importante é esse: o padrão é FALHAR, não vazar. Se um programador
 * esquecer de filtrar, o sistema quebra em vez de mostrar o dado do vizinho.
 */
@Injectable()
export class TenantPrismaService {
  /**
   * Use assim: `this.tenantPrisma.db.brand.findMany()`
   * (sem precisar escrever `where: { tenantId }` — ele entra sozinho)
   */
  readonly db: PrismaClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TenantContextService,
  ) {
    const extended = this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Tabela que não pertence a tenant (ex.: Tenant) passa direto.
            if (!TENANT_SCOPED_MODELS.has(model)) {
              return query(args);
            }

            const tenantId = context.getTenantId();

            if (!tenantId) {
              throw new Error(
                `Consulta bloqueada: tentou acessar "${model}" sem saber de qual tenant. ` +
                  `Use o PrismaService cru se esta operação for mesmo de sistema.`,
              );
            }

            const next: any = { ...(args ?? {}) };

            if (WHERE_OPERATIONS.has(operation)) {
              next.where = { ...(next.where ?? {}), tenantId };
            }

            if (operation === 'create' || operation === 'createMany') {
              next.data = withTenant(next.data, tenantId);
            }

            if (operation === 'upsert') {
              next.where = { ...(next.where ?? {}), tenantId };
              next.create = withTenant(next.create, tenantId);
            }

            return query(next);
          },
        },
      },
    });

    // O Prisma devolve um tipo "estendido" bem complicado de escrever.
    // Como o comportamento das consultas é idêntico, tratamos como PrismaClient
    // para manter o autocompletar simples no resto do projeto.
    this.db = extended as unknown as PrismaClient;
  }
}

/** Carimba o tenantId no dado que vai ser gravado (aceita um ou vários). */
function withTenant(data: any, tenantId: string) {
  if (Array.isArray(data)) {
    return data.map((item) => ({ ...item, tenantId }));
  }
  return { ...(data ?? {}), tenantId };
}
