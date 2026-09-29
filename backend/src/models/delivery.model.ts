import type { Knex } from 'knex';
import type { DeliveryDto, DeliveryStatus, DeliveryStatusEventDto } from '@fleetworkslog/shared';

export interface DeliveryRow {
  id: string;
  shipment_id: string;
  offer_id: string;
  status: DeliveryStatus;
  is_late: boolean;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  proof_of_delivery_url: string | null;
  created_at: Date;
  updated_at: Date;
  /** Motorista e veículo vêm da oferta que originou a entrega */
  driver_id: string | null;
  vehicle_id: string | null;
}

export interface DeliveryEventRow {
  id: string;
  status: DeliveryStatus;
  note: string | null;
  created_by: string | null;
  created_at: Date;
}

/** Consulta base de entregas com motorista/veículo da oferta (alias `d` / `o`). */
export function deliveriesQuery(db: Knex) {
  return db('deliveries as d')
    .join('shipment_offers as o', 'o.id', 'd.offer_id')
    .select<DeliveryRow[]>(
      'd.id',
      'd.shipment_id',
      'd.offer_id',
      'd.status',
      'd.is_late',
      'd.picked_up_at',
      'd.delivered_at',
      'd.cancelled_at',
      'd.proof_of_delivery_url',
      'd.created_at',
      'd.updated_at',
      'o.driver_id',
      'o.vehicle_id',
    );
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toDeliveryDto(row: DeliveryRow): DeliveryDto {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    offerId: row.offer_id,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    status: row.status,
    isLate: row.is_late,
    pickedUpAt: iso(row.picked_up_at),
    deliveredAt: iso(row.delivered_at),
    cancelledAt: iso(row.cancelled_at),
    proofOfDeliveryUrl: row.proof_of_delivery_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toDeliveryEventDto(row: DeliveryEventRow): DeliveryStatusEventDto {
  return {
    id: row.id,
    status: row.status,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}
