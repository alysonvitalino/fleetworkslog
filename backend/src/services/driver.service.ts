import type { Knex } from 'knex';
import {
  DriverStatus,
  Role,
  type DriverDto,
  type DriverStatusResponse,
  type ManualDriverStatus,
  type PaginatedResponse,
} from '@fleetworkslog/shared';
import { toGeography } from '../db/geo.js';
import { isForeignKeyViolation } from '../db/pg-errors.js';
import { AppError } from '../errors/app-error.js';
import { driversQuery, toDriverDto, type DriverRow } from '../models/account.model.js';
import type {
  CreateCarrierDriverInput,
  ListDriversQuery,
  UpdateAutonomousDriverInput,
  UpdateCarrierDriverInput,
} from '../schemas/account.schema.js';
import { assertCarrierExists } from './owners.service.js';
import { insertUser, translateUniqueViolation } from './users.service.js';

/** A transportadora gerencia os motoristas da frota; o autônomo gerencia a si mesmo. */
export type DriverScope = { type: 'carrier'; carrierId: string } | { type: 'autonomous' };

interface DriverStatusRow {
  id: string;
  carrier_id: string | null;
  status: DriverStatus;
  updated_at: Date;
}

const COLUMNS = ['id', 'carrier_id', 'status', 'updated_at'] as const;

function scopedDriver(db: Knex, scope: DriverScope, driverId: string) {
  const query = db('drivers').where({ id: driverId });
  return scope.type === 'carrier'
    ? query.where({ carrier_id: scope.carrierId })
    : query.whereNull('carrier_id');
}

export async function updateDriverStatus(
  db: Knex,
  scope: DriverScope,
  driverId: string,
  status: ManualDriverStatus,
): Promise<DriverStatusResponse> {
  // O filtro de status no próprio UPDATE evita corrida com uma coleta acontecendo agora
  const [row] = await scopedDriver(db, scope, driverId)
    .whereNot({ status: DriverStatus.EM_VIAGEM })
    .update({ status, updated_at: db.fn.now() })
    .returning(COLUMNS);

  if (!row) {
    const exists = await scopedDriver(db, scope, driverId).first('id');
    if (!exists) throw AppError.notFound('Motorista não encontrado');
    throw AppError.conflict(
      'Motorista em viagem: o status volta para DISPONIVEL automaticamente ao fim da entrega',
    );
  }

  const updated = row as DriverStatusRow;
  return {
    id: updated.id,
    carrierId: updated.carrier_id,
    status: updated.status,
    updatedAt: updated.updated_at.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Perfil do motorista
// ---------------------------------------------------------------------------

async function findDriver(
  db: Knex,
  driverId: string,
  scope?: DriverScope,
): Promise<DriverRow | undefined> {
  const query = driversQuery(db).where('d.id', driverId);
  if (scope?.type === 'carrier') query.where('d.carrier_id', scope.carrierId);
  if (scope?.type === 'autonomous') query.whereNull('d.carrier_id');
  return (await query.first()) as DriverRow | undefined;
}

export async function getDriver(db: Knex, driverId: string): Promise<DriverDto> {
  const row = await findDriver(db, driverId);
  if (!row) throw AppError.notFound('Motorista não encontrado');
  return toDriverDto(row);
}

/** Aplica a edição de perfil: nome fica em `users`, o resto em `drivers`. */
async function applyProfileChanges(
  trx: Knex.Transaction,
  driver: DriverRow,
  input: UpdateAutonomousDriverInput,
): Promise<void> {
  if (input.name !== undefined) {
    await trx('users')
      .where({ id: driver.user_id })
      .update({ name: input.name, updated_at: trx.fn.now() });
  }

  const changes: Record<string, unknown> = { updated_at: trx.fn.now() };
  if (input.cnhNumber !== undefined) changes.cnh_number = input.cnhNumber;
  if (input.cnhCategory !== undefined) changes.cnh_category = input.cnhCategory;
  if (input.phone !== undefined) changes.phone = input.phone ?? null;
  if (input.baseAddress !== undefined) {
    changes.base_address = input.baseAddress.address;
    changes.base_geo = toGeography(trx, input.baseAddress);
  }
  await trx('drivers').where({ id: driver.id }).update(changes);
}

async function updateProfile(
  db: Knex,
  scope: DriverScope,
  driverId: string,
  input: UpdateAutonomousDriverInput,
): Promise<DriverDto> {
  try {
    return await db.transaction(async (trx) => {
      const driver = await findDriver(trx, driverId, scope);
      if (!driver) throw AppError.notFound('Motorista não encontrado');
      await applyProfileChanges(trx, driver, input);
      return getDriver(trx, driverId);
    });
  } catch (error) {
    throw translateUniqueViolation(error);
  }
}

export const updateAutonomousDriver = (
  db: Knex,
  driverId: string,
  input: UpdateAutonomousDriverInput,
) => updateProfile(db, { type: 'autonomous' }, driverId, input);

// ---------------------------------------------------------------------------
// Motoristas da frota da transportadora (PUTF-31)
// ---------------------------------------------------------------------------

export async function listCarrierDrivers(
  db: Knex,
  carrierId: string,
  query: ListDriversQuery,
): Promise<PaginatedResponse<DriverDto>> {
  await assertCarrierExists(db, carrierId);
  const filter = (qb: Knex.QueryBuilder) => {
    qb.where('d.carrier_id', carrierId);
    if (query.status) qb.where('d.status', query.status);
  };

  const [rows, countRow] = await Promise.all([
    driversQuery(db).modify(filter).orderBy('u.name').limit(query.limit).offset(query.offset),
    db('drivers as d').modify(filter).count<{ count: string }>({ count: '*' }).first(),
  ]);

  return {
    items: rows.map(toDriverDto),
    total: Number(countRow?.count ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getCarrierDriver(
  db: Knex,
  carrierId: string,
  driverId: string,
): Promise<DriverDto> {
  const row = await findDriver(db, driverId, { type: 'carrier', carrierId });
  if (!row) throw AppError.notFound('Motorista não encontrado');
  return toDriverDto(row);
}

/**
 * Cria o usuário do motorista sem senha: ele define a senha pelo link do convite
 * (envio do e-mail e o link de uso único ficam para PUTF-76/PUTF-77).
 */
export async function createCarrierDriver(
  db: Knex,
  carrierId: string,
  input: CreateCarrierDriverInput,
): Promise<DriverDto> {
  await assertCarrierExists(db, carrierId);
  try {
    return await db.transaction(async (trx) => {
      const userId = await insertUser(trx, {
        name: input.name,
        email: input.email,
        role: Role.MOTORISTA,
        passwordHash: null,
      });
      const [driver] = await trx('drivers')
        .insert({
          user_id: userId,
          carrier_id: carrierId,
          cnh_number: input.cnhNumber,
          cnh_category: input.cnhCategory,
          phone: input.phone ?? null,
        })
        .returning<{ id: string }[]>('id');
      return getDriver(trx, (driver as { id: string }).id);
    });
  } catch (error) {
    throw translateUniqueViolation(error);
  }
}

export const updateCarrierDriver = (
  db: Knex,
  carrierId: string,
  driverId: string,
  input: UpdateCarrierDriverInput,
) => updateProfile(db, { type: 'carrier', carrierId }, driverId, input);

/** Remove o motorista e o usuário dele — só se nunca participou de oferta/entrega. */
export async function deleteCarrierDriver(
  db: Knex,
  carrierId: string,
  driverId: string,
): Promise<void> {
  try {
    await db.transaction(async (trx) => {
      const driver = await findDriver(trx, driverId, { type: 'carrier', carrierId });
      if (!driver) throw AppError.notFound('Motorista não encontrado');
      if (driver.status === DriverStatus.EM_VIAGEM) {
        throw AppError.conflict('Não é possível remover um motorista em viagem');
      }
      await trx('drivers').where({ id: driverId }).delete();
      await trx('users').where({ id: driver.user_id }).delete();
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw AppError.conflict(
        'Motorista já tem histórico de ofertas ou entregas e não pode ser removido; marque-o como INDISPONIVEL',
      );
    }
    throw error;
  }
}
