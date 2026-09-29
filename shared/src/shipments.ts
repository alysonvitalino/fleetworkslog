// Contratos de cargas (solicitações de transporte publicadas pela empresa).
// Ver docs/02-modelo-de-dados.md (Cargas e Transporte) e docs/08-precificacao.md.

import type { ShipmentStatus, VehicleType } from './enums.js';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Endereço em texto + coordenadas (o front obtém lat/lng no autocomplete de endereço). */
export interface Address extends GeoPoint {
  address: string;
}

export type ShipmentLocation = Address;

export interface ShipmentDto {
  id: string;
  shipperId: string;
  origin: ShipmentLocation;
  destination: ShipmentLocation;
  cargoType: string;
  weightKg: number;
  volumeM3: number;
  requiredVehicleType: VehicleType;
  /** Datas em ISO 8601 */
  pickupWindowStart: string;
  pickupWindowEnd: string;
  deliveryDeadline: string;
  specialRequirements: string | null;
  priceOffered: number;
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShipmentRequest {
  origin: ShipmentLocation;
  destination: ShipmentLocation;
  cargoType: string;
  weightKg: number;
  volumeM3: number;
  requiredVehicleType: VehicleType;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  deliveryDeadline: string;
  specialRequirements?: string | null;
  priceOffered: number;
}

/** Só enquanto a carga está ABERTA. `origin`/`destination` são substituídos por inteiro. */
export type UpdateShipmentRequest = Partial<CreateShipmentRequest>;
