/**
 * PORTA: importar cardápio e pedidos de marketplaces (iFood, etc.).
 * É o que permite o "agregador de canais num painel só".
 */

export const MARKETPLACE_IMPORT = 'MARKETPLACE_IMPORT';

export interface ExternalMenuItem {
  externalId: string;
  name: string;
  description?: string;
  priceCents: number;
  category: string;
  imageUrl?: string;
}

export interface ExternalOrder {
  externalId: string;
  source: 'ifood';
  placedAt: string;
  customerName: string;
  totalCents: number;
  items: Array<{ name: string; quantity: number; priceCents: number }>;
}

export interface MarketplaceImport {
  /** Puxa o cardápio publicado no marketplace. */
  importMenu(tenantId: string, brandId: string): Promise<ExternalMenuItem[]>;

  /** Puxa pedidos novos. */
  pullOrders(tenantId: string, brandId: string): Promise<ExternalOrder[]>;

  /** Confirma ao marketplace que o pedido foi aceito. */
  acknowledgeOrder(externalId: string): Promise<void>;
}
