import {
  VehicleStatus,
  type ManualVehicleStatus,
  type PaginatedResponse,
  type VehicleDto,
} from '@fleetworkslog/shared';
import { isForeignKeyViolation, isUniqueViolation } from '../db/pg-errors.js';
import { AppError } from '../errors/app-error.js';
import { toVehicleDto, type VehicleRow } from '../models/vehicle.model.js';
import type { VehicleOwner, VehicleRepository } from '../repositories/vehicle.repository.js';
import type {
  CreateVehicleInput,
  ListVehiclesQuery,
  UpdateVehicleInput,
} from '../schemas/vehicle.schema.js';
import type { OwnerService } from './owners.service.js';

export type { VehicleOwner } from '../repositories/vehicle.repository.js';

/** Regras de negócio da frota (veículos de transportadora e de motorista autônomo). */
export class VehicleService {
  constructor(
    private readonly vehicles: VehicleRepository,
    private readonly owners: OwnerService,
  ) {}

  async list(
    owner: VehicleOwner,
    query: ListVehiclesQuery,
  ): Promise<PaginatedResponse<VehicleDto>> {
    await this.owners.assertPartyExists(owner);
    const { rows, total } = await this.vehicles.list(owner, query);
    return { items: rows.map(toVehicleDto), total, limit: query.limit, offset: query.offset };
  }

  async get(owner: VehicleOwner, vehicleId: string): Promise<VehicleDto> {
    return toVehicleDto(await this.findOwnedOrFail(owner, vehicleId));
  }

  async create(owner: VehicleOwner, input: CreateVehicleInput): Promise<VehicleDto> {
    await this.owners.assertPartyExists(owner);
    try {
      return toVehicleDto(await this.vehicles.create(owner, input));
    } catch (error) {
      throw translatePlateConflict(error);
    }
  }

  async update(
    owner: VehicleOwner,
    vehicleId: string,
    input: UpdateVehicleInput,
  ): Promise<VehicleDto> {
    let row: VehicleRow | undefined;
    try {
      row = await this.vehicles.update(owner, vehicleId, input);
    } catch (error) {
      throw translatePlateConflict(error);
    }
    if (!row) throw AppError.notFound('Veículo não encontrado');
    return toVehicleDto(row);
  }

  /** EM_VIAGEM é controlado pelo sistema: o dono só alterna DISPONIVEL ↔ MANUTENCAO. */
  async updateStatus(
    owner: VehicleOwner,
    vehicleId: string,
    status: ManualVehicleStatus,
  ): Promise<VehicleDto> {
    const row = await this.vehicles.updateStatusUnlessInTrip(owner, vehicleId, status);
    if (row) return toVehicleDto(row);

    await this.findOwnedOrFail(owner, vehicleId); // 404 se não existe
    throw AppError.conflict(
      'Veículo em viagem: o status volta para DISPONIVEL automaticamente ao fim da entrega',
    );
  }

  async delete(owner: VehicleOwner, vehicleId: string): Promise<void> {
    const vehicle = await this.findOwnedOrFail(owner, vehicleId);
    if (vehicle.status === VehicleStatus.EM_VIAGEM) {
      throw AppError.conflict('Não é possível remover um veículo em viagem');
    }
    try {
      await this.vehicles.delete(vehicleId);
    } catch (error) {
      // A FK de ofertas/entregas impede apagar um veículo com histórico
      if (isForeignKeyViolation(error)) {
        throw AppError.conflict(
          'Veículo já usado em ofertas ou entregas e não pode ser removido; marque-o como MANUTENCAO',
        );
      }
      throw error;
    }
  }

  private async findOwnedOrFail(owner: VehicleOwner, vehicleId: string): Promise<VehicleRow> {
    const row = await this.vehicles.findOwned(owner, vehicleId);
    if (!row) throw AppError.notFound('Veículo não encontrado');
    return row;
  }
}

function translatePlateConflict(error: unknown): unknown {
  return isUniqueViolation(error, 'vehicles_plate_unique')
    ? AppError.conflict('Já existe um veículo cadastrado com essa placa')
    : error;
}
