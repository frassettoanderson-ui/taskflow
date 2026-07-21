/**
 * PORTA: despacho de entregador (motoboy).
 * Serve tanto para a frota própria do restaurante quanto para o pool
 * compartilhado do portal, mais pra frente.
 */

export const DELIVERY_PROVIDER = 'DELIVERY_PROVIDER';

export type DispatchStatus =
  | 'SEARCHING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'CANCELED';

export interface DispatchInput {
  tenantId: string;
  orderId: string;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  /** quanto o entregador recebe, em centavos */
  courierPayoutCents: number;
}

export interface Dispatch {
  id: string;
  status: DispatchStatus;
  courierName?: string;
  courierPhone?: string;
  trackingUrl?: string;
}

export interface DeliveryProvider {
  dispatch(input: DispatchInput): Promise<Dispatch>;
  get(dispatchId: string): Promise<Dispatch>;
  cancel(dispatchId: string, reason: string): Promise<Dispatch>;
}
