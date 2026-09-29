// Contratos dos eventos WebSocket (Socket.IO).
// Ver docs/05-armazenamento-gps.md para o fluxo de posição.

import type { DeliveryStatus } from './enums.js';

export interface DriverPositionPayload {
  driverId: string;
  deliveryId: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  /** ISO 8601 — horário em que o GPS registrou a posição no aparelho */
  recordedAt: string;
}

export interface DeliveryStatusChangedPayload {
  deliveryId: string;
  status: DeliveryStatus;
  isLate: boolean;
  changedAt: string;
}

/** Eventos enviados pelo cliente (app do motorista) para o servidor. */
export interface ClientToServerEvents {
  'driver:position': (payload: DriverPositionPayload) => void;
  'delivery:subscribe': (payload: { deliveryId: string }) => void;
  'delivery:unsubscribe': (payload: { deliveryId: string }) => void;
}

/** Eventos enviados pelo servidor para quem acompanha uma entrega. */
export interface ServerToClientEvents {
  'driver:position': (payload: DriverPositionPayload) => void;
  'delivery:status': (payload: DeliveryStatusChangedPayload) => void;
}
