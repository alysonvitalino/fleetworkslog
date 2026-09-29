import type { VehicleDto, VehicleStatus, VehicleType } from '@fleetworkslog/shared';

export interface VehicleRow {
  id: string;
  carrier_id: string | null;
  owner_driver_id: string | null;
  plate: string;
  type: VehicleType;
  // O driver `pg` devolve NUMERIC como string para não perder precisão
  capacity_kg: string;
  capacity_m3: string;
  status: VehicleStatus;
  created_at: Date;
  updated_at: Date;
}

export const VEHICLE_COLUMNS = [
  'id',
  'carrier_id',
  'owner_driver_id',
  'plate',
  'type',
  'capacity_kg',
  'capacity_m3',
  'status',
  'created_at',
  'updated_at',
] as const;

export function toVehicleDto(row: VehicleRow): VehicleDto {
  return {
    id: row.id,
    carrierId: row.carrier_id,
    ownerDriverId: row.owner_driver_id,
    plate: row.plate,
    type: row.type,
    capacityKg: Number(row.capacity_kg),
    capacityM3: Number(row.capacity_m3),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
