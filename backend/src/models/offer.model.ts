import type { Knex } from 'knex';
import type { OfferStatus, ShipmentOfferDto } from '@fleetworkslog/shared';

export interface OfferRow {
  id: string;
  shipment_id: string;
  carrier_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  price_proposed: string;
  status: OfferStatus;
  created_at: Date;
  updated_at: Date;
  /** Vem do join com shipments: define se a oferta é contraproposta */
  price_offered: string;
}

/** Consulta base de ofertas, já com o preço sugerido da carga (alias `o` / `s`). */
export function offersQuery(db: Knex) {
  return db('shipment_offers as o')
    .join('shipments as s', 's.id', 'o.shipment_id')
    .select<OfferRow[]>(
      'o.id',
      'o.shipment_id',
      'o.carrier_id',
      'o.driver_id',
      'o.vehicle_id',
      'o.price_proposed',
      'o.status',
      'o.created_at',
      'o.updated_at',
      's.price_offered',
    );
}

export function toOfferDto(row: OfferRow): ShipmentOfferDto {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    carrierId: row.carrier_id,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    priceProposed: Number(row.price_proposed),
    isCounterProposal: Number(row.price_proposed) !== Number(row.price_offered),
    assignmentPending: row.driver_id === null || row.vehicle_id === null,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
