import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AssinaturaExterna,
  BillingProvider,
  CriarAssinaturaInput,
  FaturaExterna,
} from './billing.port';

/**
 * ADAPTADOR FAKE DE COBRANÇA DA ASSINATURA.
 *
 * Finge ser um cobrador recorrente (Vindi, Iugu, Stripe Billing). Cria
 * assinatura, emite fatura e devolve um link de pagamento de mentira.
 * Nenhuma cobrança real, nenhuma conta em serviço externo.
 */
@Injectable()
export class FakeBillingProvider implements BillingProvider {
  private readonly logger = new Logger('Cobranca(fake)');

  private readonly assinaturas = new Map<string, AssinaturaExterna>();
  private readonly faturas = new Map<string, FaturaExterna>();

  async criarAssinatura(input: CriarAssinaturaInput): Promise<AssinaturaExterna> {
    const id = `sub_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const assinatura: AssinaturaExterna = {
      id,
      status: (input.trialDays ?? 0) > 0 ? 'TRIALING' : 'ACTIVE',
    };
    this.assinaturas.set(id, assinatura);

    this.logger.log(
      `→ assinatura ${id} para "${input.tenantName}" no plano ${input.planCode} ` +
        `(${input.monthlyPriceCents} centavos/mês${input.trialDays ? `, ${input.trialDays} dias grátis` : ''})`,
    );

    return assinatura;
  }

  async trocarPlano(externalId: string, planCode: string, monthlyPriceCents: number) {
    const a = this.assinaturas.get(externalId);
    if (!a) throw new NotFoundException('Assinatura não encontrada no cobrador fake.');
    a.status = 'ACTIVE';
    this.logger.log(`→ assinatura ${externalId} trocou para ${planCode} (${monthlyPriceCents})`);
    return a;
  }

  async cancelar(externalId: string) {
    const a = this.assinaturas.get(externalId);
    if (!a) throw new NotFoundException('Assinatura não encontrada no cobrador fake.');
    a.status = 'CANCELED';
    this.logger.log(`→ assinatura ${externalId} cancelada`);
    return a;
  }

  async emitirFatura(input: {
    subscriptionExternalId: string;
    amountCents: number;
    periodFrom: Date;
    periodTo: Date;
    dueDate: Date;
  }): Promise<FaturaExterna> {
    const id = `inv_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const fatura: FaturaExterna = {
      id,
      status: 'OPEN',
      amountCents: input.amountCents,
      paymentUrl: `/fatura-fake/${id}`,
    };
    this.faturas.set(id, fatura);

    this.logger.log(
      `→ fatura ${id} de ${input.amountCents} centavos, vence ${input.dueDate.toLocaleDateString('pt-BR')}`,
    );

    return fatura;
  }

  async handleWebhook(payload: unknown) {
    const p = payload as { invoiceExternalId?: string; status?: FaturaExterna['status'] };
    if (!p?.invoiceExternalId || !p?.status) return null;

    const f = this.faturas.get(p.invoiceExternalId);
    if (f) f.status = p.status;

    return { invoiceExternalId: p.invoiceExternalId, status: p.status };
  }
}
