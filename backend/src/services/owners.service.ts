import type { Knex } from 'knex';
import { AppError } from '../errors/app-error.js';
import { OwnerRepository } from '../repositories/owner.repository.js';

// Garante que o "dono" informado no path existe e é do tipo certo antes de listar/criar
// algo em nome dele. Um ID de empresa passado onde se espera transportadora vira 404.

/**
 * Quem tem frota e oferta no marketplace: uma transportadora ou um motorista autônomo
 * (que funciona como "transportadora de um veículo só" — docs/02-modelo-de-dados.md).
 */
export type Party =
  { type: 'carrier'; carrierId: string } | { type: 'autonomous'; driverId: string };

export class OwnerService {
  constructor(private readonly owners: OwnerRepository) {}

  async assertCarrierExists(carrierId: string): Promise<void> {
    if (!(await this.owners.carrierExists(carrierId))) {
      throw AppError.notFound('Transportadora não encontrada');
    }
  }

  async assertShipperExists(companyId: string): Promise<void> {
    if (!(await this.owners.shipperExists(companyId))) {
      throw AppError.notFound('Empresa não encontrada');
    }
  }

  async assertAutonomousDriverExists(driverId: string): Promise<void> {
    if (!(await this.owners.autonomousDriverExists(driverId))) {
      throw AppError.notFound('Motorista autônomo não encontrado');
    }
  }

  assertPartyExists(party: Party): Promise<void> {
    return party.type === 'carrier'
      ? this.assertCarrierExists(party.carrierId)
      : this.assertAutonomousDriverExists(party.driverId);
  }
}

/**
 * Atalho para os módulos que ainda não usam classes (marketplace). Recebe a conexão
 * atual, que pode ser uma transação.
 */
export function assertPartyExists(db: Knex, party: Party): Promise<void> {
  return new OwnerService(new OwnerRepository(db)).assertPartyExists(party);
}
