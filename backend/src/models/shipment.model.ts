import type { Knex } from 'knex';
import type { ShipmentDto, ShipmentStatus, VehicleType } from '@fleetworkslog/shared';
import { selectLatLng } from '../db/geo.js';

export interface ShipmentRow {
  id: string;
  shipper_id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  cargo_type: string;
  weight_kg: string;
  volume_m3: string;
  required_vehicle_type: VehicleType;
  pickup_window_start: Date;
  pickup_window_end: Date;
  delivery_deadline: Date;
  special_requirements: string | null;
  price_offered: string;
  status: ShipmentStatus;
  created_at: Date;
  updated_at: Date;
}

export function shipmentColumns(db: Knex): (string | Knex.Raw)[] {
  return [
    'id',
    'shipper_id',
    'origin_address',
    ...selectLatLng(db, 'origin_geo', 'origin'),
    'destination_address',
    ...selectLatLng(db, 'destination_geo', 'destination'),
    'cargo_type',
    'weight_kg',
    'volume_m3',
    'required_vehicle_type',
    'pickup_window_start',
    'pickup_window_end',
    'delivery_deadline',
    'special_requirements',
    'price_offered',
    'status',
    'created_at',
    'updated_at',
  ];
}

export function toShipmentDto(row: ShipmentRow): ShipmentDto {
  return {
    id: row.id,
    shipperId: row.shipper_id,
    origin: { address: row.origin_address, lat: row.origin_lat, lng: row.origin_lng },
    destination: {
      address: row.destination_address,
      lat: row.destination_lat,
      lng: row.destination_lng,
    },
    cargoType: row.cargo_type,
    weightKg: Number(row.weight_kg),
    volumeM3: Number(row.volume_m3),
    requiredVehicleType: row.required_vehicle_type,
    pickupWindowStart: row.pickup_window_start.toISOString(),
    pickupWindowEnd: row.pickup_window_end.toISOString(),
    deliveryDeadline: row.delivery_deadline.toISOString(),
    specialRequirements: row.special_requirements,
    priceOffered: Number(row.price_offered),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
