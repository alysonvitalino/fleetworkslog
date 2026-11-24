import {
  DriverStatus,
  type DriverDto,
  type DriverStatusResponse,
  type ManualDriverStatus,
  type PaginatedResponse,
} from '@fleetworkslog/shared';
import { isForeignKeyViolation } from '../db/pg-errors.js';
import { AppError } from '../errors/app-error.js';
import { toDriverDto, type DriverRow } from '../models/account.model.js';
import type { DriverRepository, DriverScope } from '../repositories/driver.repository.js';
import type {
  CreateCarrierDriverInput,
  ListDriversQuery,
  UpdateAutonomousDriverInput,
  UpdateCarrierDriverInput,
} from '../schemas/account.schema.js';
import type { OwnerService } from './owners.service.js';
import { translateUniqueViolation } from './users.service.js';

export type { DriverScope } from '../repositories/driver.repository.js';

/** Regras de negócio dos motoristas: frota da transportadora e perfil do autônomo. */
export class DriverService {
  constructor(
    private readonly drivers: DriverRepository,
    private readonly owners: OwnerService,
  ) {}

  /** EM_VIAGEM é controlado pelo sistema: o motorista só alterna DISPONIVEL ↔ INDISPONIVEL. */
  async updateStatus(
    scope: DriverScope,
    driverId: string,
    status: ManualDriverStatus,
  ): Promise<DriverStatusResponse> {
    const row = await this.drivers.updateStatusUnlessInTrip(scope, driverId, status);
    if (!row) {
      if (!(await this.drivers.existsInScope(scope, driverId))) {
        throw AppError.notFound('Motorista não encontrado');
      }
      throw AppError.conflict(
        'Motorista em viagem: o status volta para DISPONIVEL automaticamente ao fim da entrega',
      );
    }
    return {
      id: row.id,
      carrierId: row.carrier_id,
      status: row.status,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async getDriver(driverId: string): Promise<DriverDto> {
    return getOrFail(this.drivers, driverId);
  }

  updateAutonomousDriver(driverId: string, input: UpdateAutonomousDriverInput): Promise<DriverDto> {
    return this.updateProfile({ type: 'autonomous' }, driverId, input);
  }

  // -------------------------------------------------------------------------
  // Motoristas da frota da transportadora (PUTF-31)
  // -------------------------------------------------------------------------

  async listCarrierDrivers(
    carrierId: string,
    query: ListDriversQuery,
  ): Promise<PaginatedResponse<DriverDto>> {
    await this.owners.assertCarrierExists(carrierId);
    const { rows, total } = await this.drivers.listByCarrier(carrierId, query);
    return { items: rows.map(toDriverDto), total, limit: query.limit, offset: query.offset };
  }

  async getCarrierDriver(carrierId: string, driverId: string): Promise<DriverDto> {
    return getOrFail(this.drivers, driverId, { type: 'carrier', carrierId });
  }

  /**
   * Cria o usuário do motorista sem senha: ele define a senha pelo link do convite
   * (envio do e-mail e o link de uso único ficam para PUTF-76/PUTF-77).
   */
  async createCarrierDriver(
    carrierId: string,
    input: CreateCarrierDriverInput,
  ): Promise<DriverDto> {
    await this.owners.assertCarrierExists(carrierId);
    try {
      return await this.drivers.transaction(async (repository) => {
        const driverId = await repository.createForCarrier(carrierId, input);
        return getOrFail(repository, driverId);
      });
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  updateCarrierDriver(
    carrierId: string,
    driverId: string,
    input: UpdateCarrierDriverInput,
  ): Promise<DriverDto> {
    return this.updateProfile({ type: 'carrier', carrierId }, driverId, input);
  }

  /** Remove o motorista e o usuário dele — só se nunca participou de oferta/entrega. */
  async deleteCarrierDriver(carrierId: string, driverId: string): Promise<void> {
    try {
      await this.drivers.transaction(async (repository) => {
        const driver = await findOrFail(repository, driverId, { type: 'carrier', carrierId });
        if (driver.status === DriverStatus.EM_VIAGEM) {
          throw AppError.conflict('Não é possível remover um motorista em viagem');
        }
        await repository.deleteWithUser(driver);
      });
    } catch (error) {
      // A FK de ofertas/entregas impede apagar um motorista com histórico
      if (isForeignKeyViolation(error)) {
        throw AppError.conflict(
          'Motorista já tem histórico de ofertas ou entregas e não pode ser removido; marque-o como INDISPONIVEL',
        );
      }
      throw error;
    }
  }

  private async updateProfile(
    scope: DriverScope,
    driverId: string,
    input: UpdateAutonomousDriverInput,
  ): Promise<DriverDto> {
    try {
      return await this.drivers.transaction(async (repository) => {
        const driver = await findOrFail(repository, driverId, scope);
        await repository.updateProfile(driver, input);
        return getOrFail(repository, driverId);
      });
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }
}

async function findOrFail(
  repository: DriverRepository,
  driverId: string,
  scope?: DriverScope,
): Promise<DriverRow> {
  const row = await repository.findById(driverId, scope);
  if (!row) throw AppError.notFound('Motorista não encontrado');
  return row;
}

async function getOrFail(
  repository: DriverRepository,
  driverId: string,
  scope?: DriverScope,
): Promise<DriverDto> {
  return toDriverDto(await findOrFail(repository, driverId, scope));
}
