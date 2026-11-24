import type { Knex } from 'knex';
import { VehicleStatus } from '@fleetworkslog/shared';
import { VEHICLE_COLUMNS, type VehicleRow } from '../models/vehicle.model.js';
import type { UpdateVehicleInput } from '../schemas/vehicle.schema.js';
import type { Party } from '../services/owners.service.js';
import { BaseRepository, type PageFilter, type PagedRows } from './base.repository.js';

/** Veículo é da frota de uma transportadora ou próprio de um motorista autônomo. */
export type VehicleOwner = Party;

/** Acesso à tabela `vehicles`. Toda consulta é filtrada pelo dono do veículo. */
export class VehicleRepository extends BaseRepository<VehicleRepository> {
  protected withConnection(connection: Knex): VehicleRepository {
    return new VehicleRepository(connection);
  }

  async list(
    owner: VehicleOwner,
    filter: PageFilter<VehicleStatus>,
  ): Promise<PagedRows<VehicleRow>> {
    const base = this.db('vehicles')
      .where(ownerColumns(owner))
      .modify((qb) => {
        if (filter.status) qb.where({ status: filter.status });
      });

    const [rows, countRow] = await Promise.all([
      base
        .clone()
        .select(VEHICLE_COLUMNS)
        .orderBy('plate')
        .limit(filter.limit)
        .offset(filter.offset),
      base.clone().count<{ count: string }>({ count: '*' }).first(),
    ]);
    return { rows: rows as VehicleRow[], total: Number(countRow?.count ?? 0) };
  }

  async findOwned(owner: VehicleOwner, vehicleId: string): Promise<VehicleRow | undefined> {
    return this.db('vehicles')
      .where({ id: vehicleId, ...ownerColumns(owner) })
      .first(VEHICLE_COLUMNS);
  }

  async create(owner: VehicleOwner, input: UpdateVehicleInput): Promise<VehicleRow> {
    const [row] = await this.db('vehicles')
      .insert({ ...toRowFields(input), ...ownerColumns(owner) })
      .returning(VEHICLE_COLUMNS);
    return row as VehicleRow;
  }

  /** Devolve undefined se o veículo não existe ou é de outro dono. */
  async update(
    owner: VehicleOwner,
    vehicleId: string,
    input: UpdateVehicleInput,
  ): Promise<VehicleRow | undefined> {
    const [row] = await this.db('vehicles')
      .where({ id: vehicleId, ...ownerColumns(owner) })
      .update({ ...toRowFields(input), updated_at: this.db.fn.now() })
      .returning(VEHICLE_COLUMNS);
    return row as VehicleRow | undefined;
  }

  /**
   * Altera o status só se o veículo não estiver EM_VIAGEM. O filtro no próprio UPDATE
   * evita corrida com uma coleta acontecendo ao mesmo tempo.
   */
  async updateStatusUnlessInTrip(
    owner: VehicleOwner,
    vehicleId: string,
    status: VehicleStatus,
  ): Promise<VehicleRow | undefined> {
    const [row] = await this.db('vehicles')
      .where({ id: vehicleId, ...ownerColumns(owner) })
      .whereNot({ status: VehicleStatus.EM_VIAGEM })
      .update({ status, updated_at: this.db.fn.now() })
      .returning(VEHICLE_COLUMNS);
    return row as VehicleRow | undefined;
  }

  async delete(vehicleId: string): Promise<void> {
    await this.db('vehicles').where({ id: vehicleId }).delete();
  }
}

function ownerColumns(owner: VehicleOwner) {
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
