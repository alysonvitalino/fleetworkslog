import type { Knex } from 'knex';
import {
  VehicleStatus,
  type ManualVehicleStatus,
  type PaginatedResponse,
  type VehicleDto,
} from '@fleetworkslog/shared';
import { isForeignKeyViolation, isUniqueViolation } from '../db/pg-errors.js';
import { AppError } from '../errors/app-error.js';
import { VEHICLE_COLUMNS, toVehicleDto, type VehicleRow } from '../models/vehicle.model.js';
import type {
  CreateVehicleInput,
  ListVehiclesQuery,
  UpdateVehicleInput,
} from '../schemas/vehicle.schema.js';
import { assertPartyExists, type Party } from './owners.service.js';

/** Veículo é da frota de uma transportadora ou próprio de um motorista autônomo. */
export type VehicleOwner = Party;

export function vehicleOwnerFilter(owner: VehicleOwner) {
  return owner.type === 'carrier'
    ? { carrier_id: owner.carrierId }
    : { owner_driver_id: owner.driverId };
}

function toRowFields(input: UpdateVehicleInput) {
  return {
    plate: input.plate,
    type: input.type,
    capacity_kg: input.capacityKg,
    capacity_m3: input.capacityM3,
  };
}

function plateConflict(error: unknown): unknown {
  return isUniqueViolation(error, 'vehicles_plate_unique')
    ? AppError.conflict('Já existe um veículo cadastrado com essa placa')
    : error;
}

async function findOwnedVehicle(
  db: Knex,
  owner: VehicleOwner,
  vehicleId: string,
): Promise<VehicleRow> {
  const row = await db('vehicles')
    .where({ id: vehicleId, ...vehicleOwnerFilter(owner) })
    .first(VEHICLE_COLUMNS);
  if (!row) throw AppError.notFound('Veículo não encontrado');
  return row;
}

export async function listVehicles(
  db: Knex,
  owner: VehicleOwner,
  query: ListVehiclesQuery,
): Promise<PaginatedResponse<VehicleDto>> {
  await assertPartyExists(db, owner);
  const base = db('vehicles')
    .where(vehicleOwnerFilter(owner))
    .modify((qb) => {
      if (query.status) qb.where({ status: query.status });
    });

  const [rows, countRow] = await Promise.all([
    base.clone().select(VEHICLE_COLUMNS).orderBy('plate').limit(query.limit).offset(query.offset),
    base.clone().count<{ count: string }>({ count: '*' }).first(),
  ]);

  return {
    items: rows.map(toVehicleDto),
    total: Number(countRow?.count ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getVehicle(
  db: Knex,
  owner: VehicleOwner,
  vehicleId: string,
): Promise<VehicleDto> {
  return toVehicleDto(await findOwnedVehicle(db, owner, vehicleId));
}

export async function createVehicle(
  db: Knex,
  owner: VehicleOwner,
  input: CreateVehicleInput,
): Promise<VehicleDto> {
  await assertPartyExists(db, owner);
  try {
    const [row] = await db('vehicles')
      .insert({ ...toRowFields(input), ...vehicleOwnerFilter(owner) })
      .returning(VEHICLE_COLUMNS);
    return toVehicleDto(row as VehicleRow);
  } catch (error) {
    throw plateConflict(error);
  }
}

export async function updateVehicle(
  db: Knex,
  owner: VehicleOwner,
  vehicleId: string,
  input: UpdateVehicleInput,
): Promise<VehicleDto> {
  try {
    const [row] = await db('vehicles')
      .where({ id: vehicleId, ...vehicleOwnerFilter(owner) })
      .update({ ...toRowFields(input), updated_at: db.fn.now() })
      .returning(VEHICLE_COLUMNS);
    if (!row) throw AppError.notFound('Veículo não encontrado');
    return toVehicleDto(row as VehicleRow);
  } catch (error) {
    throw plateConflict(error);
  }
}

export async function updateVehicleStatus(
  db: Knex,
  owner: VehicleOwner,
  vehicleId: string,
  status: ManualVehicleStatus,
): Promise<VehicleDto> {
  // O filtro de status no próprio UPDATE evita corrida com uma coleta acontecendo agora
  const [row] = await db('vehicles')
    .where({ id: vehicleId, ...vehicleOwnerFilter(owner) })
    .whereNot({ status: VehicleStatus.EM_VIAGEM })
    .update({ status, updated_at: db.fn.now() })
    .returning(VEHICLE_COLUMNS);
  if (row) return toVehicleDto(row as VehicleRow);

  await findOwnedVehicle(db, owner, vehicleId); // 404 se não existe
  throw AppError.conflict(
    'Veículo em viagem: o status volta para DISPONIVEL automaticamente ao fim da entrega',
  );
}

export async function deleteVehicle(
  db: Knex,
  owner: VehicleOwner,
  vehicleId: string,
): Promise<void> {
  const vehicle = await findOwnedVehicle(db, owner, vehicleId);
  if (vehicle.status === VehicleStatus.EM_VIAGEM) {
    throw AppError.conflict('Não é possível remover um veículo em viagem');
  }
  try {
    await db('vehicles').where({ id: vehicleId }).delete();
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw AppError.conflict(
        'Veículo já usado em ofertas ou entregas e não pode ser removido; marque-o como MANUTENCAO',
      );
    }
    throw error;
  }
}
