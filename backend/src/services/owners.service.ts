import type { Knex } from 'knex';
import { CompanyType } from '@fleetworkslog/shared';
import { AppError } from '../errors/app-error.js';

// Garante que o "dono" informado no path existe e é do tipo certo antes de listar/criar
// algo em nome dele. Um ID de empresa passado onde se espera transportadora vira 404.

/**
 * Quem tem frota e oferta no marketplace: uma transportadora ou um motorista autônomo
 * (que funciona como "transportadora de um veículo só" — docs/02-modelo-de-dados.md).
 */
export type Party =
  { type: 'carrier'; carrierId: string } | { type: 'autonomous'; driverId: string };

export async function assertCarrierExists(db: Knex, carrierId: string): Promise<void> {
  const carrier = await db('companies')
    .where({ id: carrierId, type: CompanyType.TRANSPORTADORA })
    .first('id');
  if (!carrier) throw AppError.notFound('Transportadora não encontrada');
}

export async function assertShipperExists(db: Knex, companyId: string): Promise<void> {
  const shipper = await db('companies')
    .where({ id: companyId, type: CompanyType.EMPRESA })
    .first('id');
  if (!shipper) throw AppError.notFound('Empresa não encontrada');
}

export async function assertAutonomousDriverExists(db: Knex, driverId: string): Promise<void> {
  const driver = await db('drivers').where({ id: driverId }).whereNull('carrier_id').first('id');
  if (!driver) throw AppError.notFound('Motorista autônomo não encontrado');
}

export function assertPartyExists(db: Knex, party: Party): Promise<void> {
  return party.type === 'carrier'
    ? assertCarrierExists(db, party.carrierId)
    : assertAutonomousDriverExists(db, party.driverId);
}
