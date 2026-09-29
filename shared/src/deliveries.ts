// Contratos da execução da entrega. Ver docs/02-modelo-de-dados.md (deliveries).

import type { DeliveryStatus } from './enums.js';
import type { ShipmentDto } from './shipments.js';

export interface DeliveryDto {
  id: string;
  shipmentId: string;
  offerId: string;
  driverId: string | null;
  vehicleId: string | null;
  status: DeliveryStatus;
  /** Atraso é flag, não status: a entrega pode estar EM_TRANSITO e atrasada ao mesmo tempo */
  isLate: boolean;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  proofOfDeliveryUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryStatusEventDto {
  id: string;
  status: DeliveryStatus;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** Entrega com os dados da carga (origem, destino, prazos) — usada na lista do motorista. */
export interface DeliveryWithShipmentDto extends DeliveryDto {
  shipment: ShipmentDto;
}

export interface DeliveryDetailDto extends DeliveryWithShipmentDto {
  events: DeliveryStatusEventDto[];
}

/** Status que o motorista pode informar, sempre um passo por vez. */
export type DriverDeliveryStatus = Extract<DeliveryStatus, 'COLETADO' | 'EM_TRANSITO' | 'ENTREGUE'>;

export interface UpdateDeliveryStatusRequest {
  status: DriverDeliveryStatus;
  note?: string;
}

export interface CancelDeliveryRequest {
  note?: string;
}
